"""Dance visualization web app for Reachy Mini.

Provides a browser-based tool to preview and compare dance moves
through interactive 2D plots and 3D animation without needing a
physical robot or MuJoCo simulator.
"""

import argparse


def main() -> None:
    """Launch the visualization server."""
    parser = argparse.ArgumentParser(description="Reachy Mini Dance Visualizer")
    parser.add_argument(
        "--port", type=int, default=8080, help="Port to serve on (default: 8080)"
    )
    args = parser.parse_args()

    import uvicorn

    from .server import app  # noqa: F811

    uvicorn.run(app, host="127.0.0.1", port=args.port)


if __name__ == "__main__":
    main()
