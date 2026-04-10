# ElFilm Worker Architecture

This document is the source of truth for how ElFilm is deployed today.

## Current Production Topology

As of 2026-04-09, ElFilm runs as three Cloudflare Workers with different responsibilities:

| Worker | Role | Source of truth | Public domain | Current status |
| --- | --- | --- | --- | --- |
| `elfilm-web` | Public frontend | [`web/`](/E:/Eslam%20Builds/elfilm/web) | `https://film.gmd.gdn` | Active |
| `elfilm` | API, archive backend, search backend, assets API | workspace root | `https://elfilm.anagmdgdn.workers.dev` | Active |
| `elfilm-site` | Astro-based alternative frontend | [`site/`](/E:/Eslam%20Builds/elfilm/site) | `https://elfilm-site.anagmdgdn.workers.dev` | Deprecated / frozen |

## Ownership Rules

- All public UX work must land in [`web/`](/E:/Eslam%20Builds/elfilm/web).
- `film.gmd.gdn` must remain attached to `elfilm-web`.
- `elfilm` is the only worker that should own D1, Vectorize, AI, and archive-data responsibilities.
- [`site/`](/E:/Eslam%20Builds/elfilm/site) is now reference-only. Do not add new public features there.
- Do not treat `elfilm-web` and `elfilm-site` as interchangeable frontends.

## Feature Placement

The public ElFilm experience now belongs in `elfilm-web`, including:

- homepage and browse experience
- first-class `/search`
- first-class `/on-this-day`
- movie, people, company, genre, and watch pages
- operator-facing archive/search status screens that still matter

Do not port generic EmDash starter features unless they are clearly part of ElFilm.

## Worker Bindings

### `elfilm` backend worker

Defined in [wrangler.toml](/E:/Eslam%20Builds/elfilm/wrangler.toml).

- `DB` via D1
- `R2`
- `VECTORIZE`
- `AI`
- `ASSETS`

This worker is responsible for:

- archive data APIs
- semantic and keyword search APIs
- similar-movie search APIs
- admin/vector search operations
- serving assets/API-backed data used by the frontend

### `elfilm-web` frontend worker

Defined in [web/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/web/wrangler.jsonc).

- `ASSETS`
- `IMAGES`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ASSET_URL`

This worker is frontend-only and should consume the `elfilm` API worker rather than binding directly to D1, Vectorize, or AI.

### `elfilm-site` deprecated Astro worker

Defined in [site/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/site/wrangler.jsonc). The generated deploy output in [site/dist/server/wrangler.json](/E:/Eslam%20Builds/elfilm/site/dist/server/wrangler.json) shows that it has direct backend-style bindings:

- `DB`
- `VECTORIZE`
- `AI`
- `MEDIA`
- `ASSETS`
- `IMAGES`
- `SESSION`
- `LOADER`

That direct-access model is no longer the target architecture for the public site.

## Deployment Rules

- Deploy frontend changes from [`web/`](/E:/Eslam%20Builds/elfilm/web) to `elfilm-web`.
- Deploy backend/API changes from the workspace root to `elfilm`.
- Do not switch `film.gmd.gdn` to `elfilm-site`.
- Do not add new deployment instructions that treat `site/` as the main frontend.

## Required Smoke Tests

After frontend work in `web/`:

- `https://film.gmd.gdn/` renders the current public frontend
- `https://film.gmd.gdn/search` works
- `https://film.gmd.gdn/on-this-day` works
- movie, people, companies, genres, and watch pages still resolve

After backend work in `elfilm`:

- vector search still responds through the API
- keyword fallback still responds through the API
- admin vector status/generation endpoints still work

## Related Docs

- [DEPLOYMENT_STEPS.md](/E:/Eslam%20Builds/elfilm/DEPLOYMENT_STEPS.md)
- [CLOUDFLARE_SETUP.md](/E:/Eslam%20Builds/elfilm/CLOUDFLARE_SETUP.md)
- [web/README.md](/E:/Eslam%20Builds/elfilm/web/README.md)
- [site/README.md](/E:/Eslam%20Builds/elfilm/site/README.md)
