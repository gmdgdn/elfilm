# ElFilm Deployment Steps

Use this checklist when deploying ElFilm so we do not drift back into multiple competing frontends.

## Live Services

- `elfilm-web` is the only public frontend
- `film.gmd.gdn` stays attached to `elfilm-web`
- `elfilm` is the API and archive backend
- `elfilm-site` is deprecated and frozen

## Frontend Deploys

Deploy public UX changes from [`web/`](/E:/Eslam%20Builds/elfilm/web) only.

```bash
cd "E:\Eslam Builds\elfilm\web"
npm install
npm run build
npx wrangler deploy
```

After deploy, smoke test:

- `https://film.gmd.gdn/`
- `https://film.gmd.gdn/search`
- `https://film.gmd.gdn/on-this-day`
- one movie page
- one person page
- one company page
- one watch page

## Backend Deploys

Deploy archive/API changes from the workspace root.

```bash
cd "E:\Eslam Builds\elfilm"
npm install
npm run build
npx wrangler deploy
```

After deploy, smoke test:

- search API still returns results
- keyword fallback still works
- similar-movie API still works
- admin vectorize status endpoint still responds

## Do Not Do These

- Do not deploy the public site from [`site/`](/E:/Eslam%20Builds/elfilm/site)
- Do not move `film.gmd.gdn` to `elfilm-site`
- Do not add new public routes only in `site/`
- Do not give `elfilm-web` direct D1, Vectorize, or AI responsibilities

## Config References

- Backend worker config: [wrangler.toml](/E:/Eslam%20Builds/elfilm/wrangler.toml)
- Frontend worker config: [web/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/web/wrangler.jsonc)
- Deprecated Astro worker config: [site/wrangler.jsonc](/E:/Eslam%20Builds/elfilm/site/wrangler.jsonc)
- Architecture summary: [ARCHITECTURE.md](/E:/Eslam%20Builds/elfilm/ARCHITECTURE.md)
