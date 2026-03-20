# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Python library of pre-built dance moves for the Reachy Mini robot. Moves are composed from low-level motion primitives (oscillations/transients) into atomic axis operations, which are then combined into named choreographies.

## Commands

```bash
# Install
pip install -e .            # Standard install
pip install -e ".[dev]"     # With dev tools (pytest, ruff)

# Lint and format
ruff check src/             # Lint (includes docstring and import sorting rules)
ruff format src/            # Format

# Run the demo
python examples/dance_demo.py                          # Preview all moves
python examples/dance_demo.py --choreography path.json # Play a choreography file
python examples/dance_demo.py --bpm 120 --start-move dizzy_spin
```

## Architecture

**Layer 1 — Motion Primitives** (`src/reachy_mini_dances_library/rhythmic_motion.py`):
`oscillation_motion()` and `transient_motion()` generate time-series values from waveform parameters (sin, cos, square, triangle, sawtooth). Configured via `OscillationParams` and `TransientParams` dataclasses.

**Layer 2 — Atomic Moves** (same file):
8 functions (`atomic_x_pos`, `atomic_y_pos`, `atomic_z_pos`, `atomic_roll`, `atomic_pitch`, `atomic_yaw`, `atomic_antenna_wiggle`, `atomic_antenna_both`) that apply a single motion primitive to one axis, returning a `MoveOffsets` dataclass (position, orientation, antenna arrays).

**Layer 3 — Named Moves** (`src/reachy_mini_dances_library/collection/dance.py`):
20 dance moves (e.g. `move_dizzy_spin`, `move_jackson_square`) that combine atomic moves via `combine_offsets()`. All registered in the `AVAILABLE_MOVES` dictionary with default params and metadata.

**Layer 4 — Playback API** (`src/reachy_mini_dances_library/dance_move.py`):
- `DanceMove` extends `reachy_mini.motion.move.Move`. Its `evaluate(t)` converts wall-clock time to beat time then returns joint positions (base pose + offsets).
- `Choreography` loads a JSON sequence of moves and plays them on the robot via `play_on()`. Note: `Choreography.evaluate()` is not yet implemented (`NotImplementedError`).

**Key pattern**: All motion functions are driven by beat time (`t_beats`). BPM sets the conversion from wall-clock time. Moves compose additively — `combine_offsets()` sums multiple `MoveOffsets` to layer independent axis motions.

## Adding a New Dance Move

Every move follows the same pattern:

1. Define a function `move_<name>(t_beats, ...) -> MoveOffsets` in `collection/dance.py`.
2. Build motion using atomic functions + `combine_offsets()`. Use `dataclasses.replace()` on a base `OscillationParams` to derive per-axis params with different amplitudes/phases.
3. Register in `AVAILABLE_MOVES` as a 3-tuple: `(callable, params_dict, metadata_dict)`.
   - `params_dict`: default kwargs passed to the move function at runtime (must include amplitude and antenna params).
   - `metadata_dict`: must include `default_duration_beats` (int) and `description` (str).
   - Use `**DEFAULT_ANTENNA_PARAMS` to inherit standard antenna defaults.
4. The demo's `DEFAULT_SKIPPED_MOVES` list in `examples/dance_demo.py` can exclude overly dynamic moves from the preview cycle.

## Choreography JSON Format

```json
{
  "bpm": 114,
  "sequence": [
    {"move": "move_name", "cycles": 2, "amplitude": 1.0}
  ]
}
```

The `amplitude` field scales all amplitude-related params (any key containing `amplitude` or `_amp`) for that step.

## Ruff Configuration

Extends default rules with `D` (pydocstyle) and `I` (isort). Ignores D203/D213 in favor of D211/D212. All new code should have docstrings.

## Forbidden Moves

`collection/forbidden.py` contains experimental moves (frequency sweeps, walking patterns) disabled by default — these can cause physical robot issues. They are stored in a separate `FORBIDDEN_MOVES` dict and must be imported explicitly.
