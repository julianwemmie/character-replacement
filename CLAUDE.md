# Project Guidelines

## Package management

Use `uv` for all Python package management. Do not use `pip` directly.

- `uv add <package>` to add dependencies
- `uv run <command>` to run scripts
- `uv sync` to install from lockfile
