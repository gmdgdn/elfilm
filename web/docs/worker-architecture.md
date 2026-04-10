# ElFilm Worker Architecture

This file is the committed architecture reference for the `web/` repository.

## Active Topology

| Worker | Responsibility | Status |
| --- | --- | --- |
| `elfilm-web` | Public frontend for `https://film.gmd.gdn` | Active |
| `elfilm` | API, archive backend, semantic search backend, assets backend | Active |
| `elfilm-site` | Legacy Astro frontend | Deprecated / frozen |

## Rules

- The public site stays on `elfilm-web`
- All public UX changes must land in `web/`
- `elfilm-web` remains frontend-only
- `elfilm` remains the only backend/archive/search worker
- `site/` is reference-only and must not receive new public product work

## Frontend Features Owned Here

- homepage and browse flows
- `/search`
- `/on-this-day`
- movie, people, company, genre, and watch pages
- operator-facing archive/search surfaces that still matter

## Config References

- Frontend worker config: [../wrangler.jsonc](/E:/Eslam%20Builds/elfilm/web/wrangler.jsonc)
- Backend worker config: [../../wrangler.toml](/E:/Eslam%20Builds/elfilm/wrangler.toml)
- Deprecated Astro config: [../../site/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/site/wrangler.jsonc)
- Workspace architecture mirror: [../../ARCHITECTURE.md](/E:/Eslam%20Builds/elfilm/ARCHITECTURE.md)
