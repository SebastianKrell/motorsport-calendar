# Repository instructions

`CLAUDE.md` is the canonical project specification. Follow it for supported
series, data-source decisions, deduplication rules, and project non-goals.

## Commands

- `npm run collect` refreshes `packages/frontend/public/data/sessions.json`.
- `npm run dev` starts the Vite frontend.
- `npm run lint` checks all TypeScript and React sources.
- `npm run typecheck` checks both workspaces.
- `npm run build` creates the production frontend.

## Architecture and conventions

- The data collector owns one adapter per external source and writes one static
  JSON file. The frontend has no backend or database.
- Keep timestamps in UTC internally and convert them to `Europe/Berlin` only
  for display.
- Use `confidence: 'date-only'` when a source has no trustworthy start time.
  Never invent dates, times, broadcasters, or URLs.
- A failing adapter must not discard previously collected data for its series.
- Add cross-series duplicate handling centrally in `dedup.ts`, not in the UI.
- Keep broadcaster defaults and event exceptions in `broadcasters.yaml`.
- Be polite to external sites: identify the project, avoid unnecessary
  requests, and prefer structured public data over brittle DOM selectors.
- Use concise German comments where domain behavior is not self-explanatory.
