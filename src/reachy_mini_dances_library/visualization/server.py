"""FastAPI server for the dance visualization web app.

Provides API endpoints to list available moves, sample move motion data,
and compute choreography sequences. Serves static frontend files.
"""

from pathlib import Path
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles

from ..collection.dance import AVAILABLE_MOVES

app = FastAPI(title="Reachy Mini Dance Visualizer")

STATIC_DIR = Path(__file__).parent / "static"

CHANNEL_NAMES = [
    "x",
    "y",
    "z",
    "roll",
    "pitch",
    "yaw",
    "antenna_left",
    "antenna_right",
]


def _numpy_safe(val: Any) -> Any:
    """Convert numpy scalars to Python natives for JSON serialization."""
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    if isinstance(val, np.ndarray):
        return val.tolist()
    return val


def _safe_params(params: dict[str, Any]) -> dict[str, Any]:
    """Convert all numpy values in a params dict to JSON-safe types."""
    return {k: _numpy_safe(v) for k, v in params.items()}


def _apply_amplitude_scaling(
    params: dict[str, Any], amplitude_scale: float
) -> dict[str, Any]:
    """Scale amplitude-related parameters, matching dance_demo.py logic."""
    scaled = params.copy()
    for key in scaled:
        if "amplitude" in key or "_amp" in key:
            scaled[key] *= amplitude_scale
    return scaled


def _sample_move(
    move_name: str,
    bpm: float = 114.0,
    amplitude: float = 1.0,
    duration_beats: float | None = None,
    samples: int = 200,
) -> dict[str, Any]:
    """Sample a move function over time and return channel data.

    Args:
        move_name: Name of the move in AVAILABLE_MOVES.
        bpm: Beats per minute for time conversion.
        amplitude: Amplitude scaling factor.
        duration_beats: Number of beats to sample. Defaults to move metadata.
        samples: Number of sample points.

    Returns:
        Dictionary with t_beats array and channels dict.

    Raises:
        HTTPException: If the move name is not found.

    """
    if move_name not in AVAILABLE_MOVES:
        raise HTTPException(status_code=404, detail=f"Move '{move_name}' not found")

    move_fn, base_params, metadata = AVAILABLE_MOVES[move_name]

    if duration_beats is None:
        duration_beats = metadata.get("default_duration_beats", 4)

    params = _apply_amplitude_scaling(base_params.copy(), amplitude)

    t_beats_arr = np.linspace(0, float(duration_beats), samples)
    channels: dict[str, list[float]] = {name: [] for name in CHANNEL_NAMES}

    for t in t_beats_arr:
        offsets = move_fn(float(t), **params)
        pos = offsets.position_offset
        ori = offsets.orientation_offset
        ant = offsets.antennas_offset
        channels["x"].append(float(pos[0]))
        channels["y"].append(float(pos[1]))
        channels["z"].append(float(pos[2]))
        channels["roll"].append(float(ori[0]))
        channels["pitch"].append(float(ori[1]))
        channels["yaw"].append(float(ori[2]))
        channels["antenna_left"].append(float(ant[0]))
        channels["antenna_right"].append(float(ant[1]))

    return {
        "move_name": move_name,
        "bpm": bpm,
        "amplitude": amplitude,
        "duration_beats": float(duration_beats),
        "samples": samples,
        "t_beats": t_beats_arr.tolist(),
        "channels": channels,
    }


@app.get("/api/moves")
def list_moves() -> dict[str, Any]:
    """List all available moves with their metadata and default parameters."""
    moves = {}
    for name, (_, params, metadata) in AVAILABLE_MOVES.items():
        moves[name] = {
            "params": _safe_params(params),
            "metadata": _safe_params(metadata),
        }
    return {"moves": moves}


@app.get("/api/move/{move_name}")
def get_move(
    move_name: str,
    bpm: float = 114.0,
    amplitude: float = 1.0,
    duration_beats: float | None = None,
    samples: int = 200,
) -> dict[str, Any]:
    """Sample a single move and return its motion data."""
    return _sample_move(
        move_name,
        bpm=bpm,
        amplitude=amplitude,
        duration_beats=duration_beats,
        samples=samples,
    )


@app.post("/api/choreography")
async def compute_choreography(
    request: Request,
    bpm: float = 114.0,
    amplitude: float = 1.0,
) -> dict[str, Any]:
    """Accept choreography JSON and return concatenated motion data.

    The request body should be a JSON object with ``bpm`` (optional) and
    ``sequence`` (list of steps with ``move``, ``cycles``, and optional
    ``amplitude`` fields).
    """
    body = await request.json()

    file_bpm = body.get("bpm", bpm)
    effective_bpm = file_bpm if file_bpm else bpm
    sequence = body.get("sequence", [])

    if not sequence:
        raise HTTPException(status_code=400, detail="Empty sequence")

    all_t: list[float] = []
    all_channels: dict[str, list[float]] = {name: [] for name in CHANNEL_NAMES}
    steps: list[dict[str, Any]] = []
    beat_offset = 0.0
    samples_per_step = 200

    for step in sequence:
        move_name = step.get("move", "")
        if move_name not in AVAILABLE_MOVES:
            raise HTTPException(
                status_code=400, detail=f"Unknown move '{move_name}' in sequence"
            )

        move_fn, base_params, metadata = AVAILABLE_MOVES[move_name]
        step_amplitude = step.get("amplitude", 1.0) * amplitude
        params = _apply_amplitude_scaling(base_params.copy(), step_amplitude)

        cycles = step.get("cycles", 1)
        subcycles_per_beat = base_params.get("subcycles_per_beat", 1.0)
        if subcycles_per_beat > 0:
            step_duration_beats = cycles / subcycles_per_beat
        else:
            step_duration_beats = float(cycles)

        t_arr = np.linspace(0, step_duration_beats, samples_per_step, endpoint=False)

        step_info = {
            "move": move_name,
            "start_beat": beat_offset,
            "end_beat": beat_offset + step_duration_beats,
            "duration_beats": step_duration_beats,
        }
        steps.append(step_info)

        for t in t_arr:
            offsets = move_fn(float(t), **params)
            pos = offsets.position_offset
            ori = offsets.orientation_offset
            ant = offsets.antennas_offset

            all_t.append(beat_offset + float(t))
            all_channels["x"].append(float(pos[0]))
            all_channels["y"].append(float(pos[1]))
            all_channels["z"].append(float(pos[2]))
            all_channels["roll"].append(float(ori[0]))
            all_channels["pitch"].append(float(ori[1]))
            all_channels["yaw"].append(float(ori[2]))
            all_channels["antenna_left"].append(float(ant[0]))
            all_channels["antenna_right"].append(float(ant[1]))

        beat_offset += step_duration_beats

    return {
        "bpm": effective_bpm,
        "amplitude": amplitude,
        "total_duration_beats": beat_offset,
        "samples": len(all_t),
        "t_beats": all_t,
        "channels": all_channels,
        "steps": steps,
    }


app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
