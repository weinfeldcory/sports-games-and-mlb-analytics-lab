# MLB Attendance App

Expo + TypeScript attendance tracker that now supports a browser-first web experience alongside the existing mobile shell.

Current product slice includes:
- responsive navigation and page shell for web
- attendance dashboard with seeded MLB history and derived stats
- game search and attendance logging flow
- editable history logbook
- profile preferences plus local import/export tools
- shared domain package for attendance and stat calculations

## Run It

From `projects/mlb-attendance-app`:

```bash
corepack pnpm install
corepack pnpm run dev:web
```

Other useful commands:

```bash
corepack pnpm run dev
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build:web
```

## Notes

- Data is currently seeded demo data and persisted locally on the device or browser.
- The web app runs through Expo web, so the same app shell continues to work for mobile.

Planning docs:
- `PRODUCT_ROADMAP_MOBILE.md`
