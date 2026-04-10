# ElFilm Cloudflare Setup

This file records the intended Cloudflare setup for ElFilm after frontend consolidation.

## Worker Roles

### `elfilm-web`

- Purpose: public frontend
- Domain: `https://film.gmd.gdn`
- Source: [`web/`](/E:/Eslam%20Builds/elfilm/web)
- Config: [web/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/web/wrangler.jsonc)

Bindings and vars:

- `ASSETS`
- `IMAGES`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ASSET_URL`

### `elfilm`

- Purpose: API, archive backend, search backend
- Domain: `https://elfilm.anagmdgdn.workers.dev`
- Source: workspace root
- Config: [wrangler.toml](/E:/Eslam%20Builds/elfilm/wrangler.toml)

Bindings:

- `DB`
- `R2`
- `VECTORIZE`
- `AI`
- `ASSETS`

### `elfilm-site`

- Purpose: legacy Astro frontend kept for reference only
- Domain: `https://elfilm-site.anagmdgdn.workers.dev`
- Source: [`site/`](/E:/Eslam%20Builds/elfilm/site)
- Config: [site/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/site/wrangler.jsonc)

This worker is deprecated and should not receive new public-site work.

## Domain and Route Rules

- Keep `film.gmd.gdn` on `elfilm-web`
- Keep API/backend traffic on `elfilm`
- Do not re-point the public domain to `elfilm-site`

## Frontend Integration Rules

- `elfilm-web` consumes the `elfilm` API over HTTP
- `elfilm-web` must not become a second backend worker
- semantic search and keyword fallback should stay behind the API worker

## References

- [ARCHITECTURE.md](/E:/Eslam%20Builds/elfilm/ARCHITECTURE.md)
- [DEPLOYMENT_STEPS.md](/E:/Eslam%20Builds/elfilm/DEPLOYMENT_STEPS.md)
