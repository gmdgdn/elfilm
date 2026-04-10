# ElFilm Cloudflare Public Deploy

This deploy path uses the source-free public dataset only.

## Files

- Schema: `prepared_cloudflare/schema.sql`
- Seed chunks: `prepared_cloudflare/seed_000.sql` through `prepared_cloudflare/seed_016.sql`
- Static assets: `public/assets/elfilm`
- Deploy helper: `scripts/deploy_public_cloudflare.py`

## Deploy

Set a Cloudflare token that can edit D1, upload Workers, and upload assets:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<token-with-d1-workers-assets-permissions>"
python scripts/deploy_public_cloudflare.py --skip-r2
```

`--skip-r2` is intentional for the default path. The public image URLs are already
`https://elfilm.net/assets/elfilm/...`, so the Worker deploy uploads `public/`
as Cloudflare Worker static assets in one pass.

## R2 Alternative

If you decide to serve images from the `elfilm-assets` R2 bucket instead, run:

```powershell
$env:CLOUDFLARE_API_TOKEN = "<token-with-r2-permissions>"
python scripts/deploy_public_cloudflare.py --skip-d1 --skip-worker
```

The R2 upload uses `prepared_cloudflare/r2_uploaded_keys.txt` as a resume file.
