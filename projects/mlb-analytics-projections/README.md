# MLB Analytics Projections

Local MLB projection workspace using `pybaseball`, DuckDB, pandas, and SQL.

## Layout

- `src/`
  Python scripts for pulls, model builds, exports, and ad hoc queries.
- `sql/`
  Modeling SQL used to build the DuckDB tables.
- `data/`
  Raw and processed exports for the MLB project.
- `viewer/`
  Local browser viewer for projections and live comparison files.
- `mlb.duckdb`
  Project-local DuckDB database.

## Common Commands

Run from the repo root:

```bash
.venv/bin/python projects/mlb-analytics-projections/src/build_modeling_tables.py
.venv/bin/python projects/mlb-analytics-projections/src/pull_live_completed_games.py --start-date 2026-03-27 --end-date 2026-04-08
.venv/bin/python projects/mlb-analytics-projections/src/export_hitter_projection_vs_current_2026.py
```

Or run from inside this folder:

```bash
../../.venv/bin/python src/build_modeling_tables.py
../../.venv/bin/python src/pull_live_completed_games.py --start-date 2026-03-27 --end-date 2026-04-08
../../.venv/bin/python src/export_hitter_projection_vs_current_2026.py
```

## Viewer

From this directory:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/viewer/`.
