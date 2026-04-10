# ElFilm Site (Deprecated Astro Frontend)

This project is no longer the active public frontend for ElFilm.

## Status

- Worker name: `elfilm-site`
- Current URL: `https://elfilm-site.anagmdgdn.workers.dev`
- Status: deprecated and frozen
- Public frontend owner: [`../web/`](/E:/Eslam%20Builds/elfilm/web)

## Why This Is Frozen

ElFilm now keeps a single public frontend:

- `elfilm-web` serves `https://film.gmd.gdn`
- `elfilm` serves backend and archive APIs
- `elfilm-site` is retained only as a reference while old functionality is consolidated into `web/`

## Rules

- Do not add new public UX features here
- Do not deploy this worker as the main site
- Do not treat this app as interchangeable with `elfilm-web`
- If a feature is still needed for the public experience, port it into [`../web/`](/E:/Eslam%20Builds/elfilm/web)

## Config References

- Deprecated worker config: [wrangler.jsonc](/E:/Eslam%20Builds/elfilm/site/wrangler.jsonc)
- Generated deploy config: [dist/server/wrangler.json](/E:/Eslam%20Builds/elfilm/site/dist/server/wrangler.json)
- Current architecture: [../ARCHITECTURE.md](/E:/Eslam%20Builds/elfilm/ARCHITECTURE.md)
