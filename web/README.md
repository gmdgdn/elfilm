# ElFilm Web Frontend

This repository is the active public frontend for ElFilm.

## Status

- Worker name: `elfilm-web`
- Public domain: `https://film.gmd.gdn`
- Frontend source of truth: [`web/`](/E:/Eslam%20Builds/elfilm/web)
- Backend/API worker: `elfilm`
- Deprecated alternative frontend: [`site/`](/E:/Eslam%20Builds/elfilm/site)

## Frontend Ownership

All public UX work must land here.

That includes:

- homepage and browse experience
- `/search`
- `/on-this-day`
- movie, people, company, genre, and watch pages
- operator-facing archive/search UI that still matters

Do not add new public features to `site/`. That app is frozen and kept only as a reference during consolidation.

## Runtime Model

`elfilm-web` is a frontend-only worker. It should call the `elfilm` API worker instead of taking direct bindings to D1, Vectorize, or AI.

Current worker config lives in [wrangler.jsonc](/E:/Eslam%20Builds/elfilm/web/wrangler.jsonc).

Important bindings and vars:

- `ASSETS`
- `IMAGES`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ASSET_URL`

## Local Development

```bash
npm install
npm run dev
```

Vinext worker development commands are also available when needed:

```bash
npm run dev:vinext
npm run build:vinext
npm run start:vinext
```

## Deploying

Deploy the public frontend from this directory:

```bash
npm run build
npx wrangler deploy
```

Do not deploy the public site from `site/`.

## Required Checks

Before shipping frontend work, verify:

- `/` still matches the approved public UX
- `/search` returns semantic search results through the API worker
- `/on-this-day` renders correctly
- movie, people, company, genre, and watch pages still work

## Related Docs

- [../ARCHITECTURE.md](/E:/Eslam%20Builds/elfilm/ARCHITECTURE.md)
- [docs/worker-architecture.md](/E:/Eslam%20Builds/elfilm/web/docs/worker-architecture.md)
- [../DEPLOYMENT_STEPS.md](/E:/Eslam%20Builds/elfilm/DEPLOYMENT_STEPS.md)
- [../CLOUDFLARE_SETUP.md](/E:/Eslam%20Builds/elfilm/CLOUDFLARE_SETUP.md)
