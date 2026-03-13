# Project Guidelines

## Package management

Use `uv` for all Python package management. Do not use `pip` directly.

- `uv add <package>` to add dependencies
- `uv run <command>` to run scripts
- `uv sync` to install from lockfile

## Modal

Before writing or modifying any code that uses the `modal` Python package, ALWAYS spawn a research subagent first to explore Modal's documentation at https://modal.com/docs. The agent should:

1. Fetch the relevant docs pages for the specific Modal features you plan to use (e.g., `modal.App`, `modal.Image`, `modal.Volume`, `modal.gpu`, `modal.Cls`, etc.)
2. Check for any API changes, deprecations, or updated patterns
3. Return the current correct usage examples and API signatures

This is required because Modal's API evolves frequently and Claude's training data may contain outdated patterns (e.g., old `modal.Stub` instead of `modal.App`, deprecated decorator syntax, etc.). Always prefer the docs over training data.
