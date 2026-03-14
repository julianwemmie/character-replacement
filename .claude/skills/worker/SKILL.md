---
description: Spawn a worker — a nested Claude CLI instance that runs a task autonomously via `claude -p`. Use when you need to delegate a subtask to a worker process, or when the user asks you to spawn/run a worker. This is intended for use by a "manager" agent that coordinates multiple workers.
---

# Spawn Worker

Spawn worker processes using the Bash tool to run the `claude` CLI in print mode. Workers are non-interactive CLI instances that execute a task and return their output.

## Basic pattern

```bash
claude -p "<task prompt>" \
  --allowedTools "Tool1 Tool2 ..." \
  --dangerously-skip-permissions \
  --model opus
```

## Parameters

| Flag | Purpose | Example |
|---|---|---|
| `-p "<prompt>"` | The task for the worker | `-p "Find all TODO comments in src/"` |
| `--allowedTools` | Which tools the worker can use | `"Bash Read Grep Glob Edit Write"` |
| `--dangerously-skip-permissions` | Required — workers are non-interactive and can't prompt for approval | |
| `--model` | Always use `opus` | `--model opus` |
| `--system-prompt` | Give the worker a role or constraints | `--system-prompt "You are a code reviewer. Only report issues, do not fix them."` |

## Available tools for workers

- `Bash` — run shell commands (scope with `Bash(git:*)`, `Bash(npm:*)`, etc.)
- `Read` — read files
- `Write` — create new files
- `Edit` — edit existing files
- `Glob` — find files by pattern
- `Grep` — search file contents
- `WebFetch` — fetch URLs
- `WebSearch` — search the web

## How to spawn

1. Determine what the worker needs to do and which tools it needs.
2. Scope tools tightly — a worker that only reads code shouldn't have `Bash` or `Write`.
3. Run the `claude -p` command via the Bash tool.
4. The worker's response comes back as stdout. Parse and use it.

## Examples

### Read-only research worker
```bash
claude -p "List all API endpoints defined in this project and summarize what each one does." \
  --allowedTools "Read Grep Glob" \
  --dangerously-skip-permissions \
  --model opus
```

### Code modification worker
```bash
claude -p "Add error handling to all database queries in src/routes/. Wrap each query in a try/catch that logs the error and returns a 500 response." \
  --allowedTools "Read Edit Grep Glob" \
  --dangerously-skip-permissions \
  --model opus
```

### Test runner worker
```bash
claude -p "Run the test suite with 'uv run pytest'. If any tests fail, read the failing test files and the source they test, then fix the failures." \
  --allowedTools "Bash Read Edit Grep Glob" \
  --dangerously-skip-permissions \
  --model opus
```

## Rules

- **Always use `--model opus`.** Every worker must run on Opus.
- **Always use `--dangerously-skip-permissions`.** Workers cannot prompt for approval.
- **Quote prompts carefully.** Use double quotes for the outer `-p` argument. Escape inner quotes or use single quotes inside.
- **Workers inherit the working directory.** They see the same repo and files you do.
- **Capture output.** The worker's response is the stdout of the `claude -p` command, so you receive it directly from Bash.
- **Set timeouts.** Workers can take a while. Use the Bash tool's timeout parameter (up to 600000ms / 10 min).
- **Parallelize.** You can spawn multiple workers in parallel using separate Bash tool calls in a single response.
