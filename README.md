# Sports Games And MLB Analytics Lab

Workspace repo with separate project folders so the MLB analytics work and the March Madness app stay isolated from each other.

## Projects

- `projects/mlb-analytics-projections`
  MLB projection modeling, DuckDB pipeline, SQL transforms, and local viewer.
- `projects/march-madness-game`
  March Madness draft room, scoring experiments, and live standings app.

## MLB Analytics Quick Start

From the repo root:

```bash
.venv/bin/python projects/mlb-analytics-projections/src/build_modeling_tables.py
.venv/bin/python projects/mlb-analytics-projections/src/pull_live_completed_games.py --start-date 2026-03-27 --end-date 2026-04-08
.venv/bin/python projects/mlb-analytics-projections/src/export_hitter_projection_vs_current_2026.py
```

Then host the viewer from the MLB project folder:

```bash
cd projects/mlb-analytics-projections
python3 -m http.server 8000
```

Open `http://localhost:8000/viewer/` to browse 2026 projections against current stats and 162-game pace.

## Session Workflow

Use the done workflow at the end of each session:

```bash
scripts/done "Short summary of what changed"
```

The workflow appends a session entry to the daily journal file, such as `journal/2026-04-06.md`, commits all non-ignored changes, and pushes the current branch to `origin`.

In Codex sessions, `done` means run `scripts/done` from the repo root. Add a short summary after it when useful:

```text
done Add hitter analysis export
```

Do not use `/done`; Codex intercepts unsupported slash commands before they reach the assistant.
