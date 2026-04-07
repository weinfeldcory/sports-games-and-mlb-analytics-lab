# Project Instructions

- When the user says `/done`, run `scripts/done` from the repository root.
- If the user includes text after `/done`, pass that text as the session summary, for example: `scripts/done "Add team offense query"`.
- The done workflow should update `journal/dev-log.md`, commit all non-ignored changes, and push the current branch to `origin`.
