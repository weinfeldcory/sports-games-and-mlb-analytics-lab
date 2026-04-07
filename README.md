# MLB Analytics Lab

Local baseball analytics workspace using `pybaseball`, DuckDB, pandas, and SQL.

## Session Workflow

Use the done workflow at the end of each session:

```bash
scripts/done "Short summary of what changed"
```

The workflow appends a dated entry to `journal/dev-log.md`, commits all non-ignored changes, and pushes the current branch to `origin`.

In Codex sessions, `/done` means run `scripts/done` from the repo root. Add a short summary after it when useful:

```text
/done Add hitter analysis export
```
