# Cloudflare Astro EmDash Refactor

## Goal

Move ElFilm from the current split of Cloudflare Worker API plus Next.js frontend toward a Cloudflare-native Astro application with EmDash CMS, while preserving the existing Egyptian film archive data pipeline.

## Current State

- Root backend is a Cloudflare Worker using Hono, D1, R2, Vectorize, and Workers AI.
- `web/` is a Next.js app with public browse/detail pages and an admin area.
- `site/` is now the active Astro + EmDash migration slice:
  - EmDash Cloudflare integration is configured.
  - ElFilm branding and seed data are applied.
  - Public Astro routes exist for `/`, `/search`, `/movies`, `/movies/[slug]`, `/movies/year/[year]`, `/people`, `/people/[slug]`, `/companies`, `/companies/[slug]`, `/genres`, and `/watch/[slug]`.
  - These routes query the existing archive tables directly from D1.
  - `robots.txt` and `sitemap.xml` are supplied by EmDash's built-in routes, so they should not be duplicated locally.
- The repo has two competing database shapes:
  - `migrations/001_create_schema.sql` is a normalized film archive schema.
  - `schema.sql` is a flatter generated schema used by newer seed files.
- The public film archive data is generated from local Python scripts, JSON datasets, and SQL seed files.

## Target Stack

- Astro app deployed on Cloudflare.
- EmDash CMS integration for editorial content, admin UX, media library, auth, menus, pages, and optional plugins.
- Cloudflare D1 as the SQL database.
- Cloudflare R2 for posters, portraits, and media uploads.
- Cloudflare Vectorize plus Workers AI for semantic movie search.
- Existing film archive tables remain domain tables, not generic CMS content, unless we intentionally decide to model movies, people, companies, and credits as EmDash collections.

## Recommended Architecture

Use a hybrid model:

- EmDash owns editorial CMS content:
  - Pages
  - Blog/news/editorial posts
  - Menus and taxonomies
  - Media library
  - Admin users and publishing workflow
- ElFilm owns archive domain data:
  - Movies
  - People
  - Companies
  - Cast and crew credits
  - Watch links
  - News/search enrichment
  - Vector embeddings

This avoids forcing thousands of imported archive records and graph-like credit relationships into CMS abstractions too early, while still gaining EmDash for the parts that should behave like WordPress.

## Migration Phases

1. Stabilize schema
   - Pick one canonical D1 schema for film archive data.
   - Prefer a normalized schema for long-term correctness.
   - Update repositories, seed generation, and admin screens to match the chosen schema.

2. Create Astro app shell
   - Scaffold Astro in a new folder such as `site/`.
   - Add the Cloudflare adapter.
   - Add EmDash integration and Cloudflare bindings.
   - Keep the existing `web/` app until equivalent routes are migrated.

3. Port public routes
   - Home
   - `/movies`
   - `/movies/[id-or-slug]`
   - `/people`
   - `/people/[id-or-slug]`
   - `/companies/[id-or-slug]`
   - `/watch/[id-or-slug]`
   - `/genres`

   Status:
   - Completed first slice for home, search, movies, movies-by-year, people, companies, watch, and genres in `site/`.
   - Remaining route parity work is primarily vector search UX, richer taxonomy/filter pages, and any bespoke admin/editorial workflows we keep outside EmDash.

4. Move API logic into Astro/Cloudflare runtime
   - Reuse repository functions where possible.
   - Replace browser fetches to the public Worker with server-side D1 binding queries.
   - Keep semantic search as an endpoint or server action backed by Workers AI and Vectorize.

5. Add EmDash CMS
   - Configure EmDash with D1 and R2.
   - Use EmDash admin at `/_emdash/admin`.
   - Add editorial collections first.
   - Decide later whether any archive entities should become editable EmDash collections.

6. Retire the old app layers
   - Remove or archive `web/` after parity.
   - Remove duplicate API endpoints once Astro routes cover the same functionality.
   - Keep data import scripts, but move them under a clear `data-pipeline/` or `scripts/` structure.

## Open Decision

The key decision is whether EmDash should manage the film archive itself or only editorial/site content.

Recommendation: start hybrid. Use EmDash for CMS/admin publishing, and keep film archive data as domain tables in D1. Revisit after the Astro app is running.

## First Implementation Slice

1. Reuse the existing `site/` Astro + EmDash app instead of creating a new folder.
2. Keep EmDash for editorial content and admin workflows.
3. Query archive tables directly from D1 for movies, people, and companies.
4. Preserve `web/` until public route parity is complete.

This keeps the migration reversible and avoids breaking the current frontend before the replacement has route parity.

## Next Recommended Slice

1. Add search/filter UX beyond server-rendered chips, ideally backed by existing Vectorize and Workers AI services.
2. Decide whether the existing Hono Worker should remain as an API surface for external clients, or whether the Astro Worker should absorb those public endpoints.
3. Move admin/editorial links and content workflows fully to EmDash, and retire the bespoke Next.js admin once equivalent archive editing screens exist or are intentionally dropped.
4. Evaluate whether archive editing itself should remain custom or be partially modeled as EmDash-managed collections later.

## Canonical Frontend Cutover

- `site/` should now be treated as the canonical public frontend.
- `web/` has begun the cutover by redirecting public route ownership for:
  - `/`
  - `/robots.txt`
  - `/sitemap.xml`
  - `/search`
  - `/posts`
  - `/posts/[slug]`
  - `/genres`
  - `/movies`
  - `/movies/year/[year]`
  - `/movies/[slug]`
  - `/people`
  - `/people/[slug]`
  - `/companies`
  - `/companies/[slug]`
  - `/watch/[slug]`
- The redirect target is controlled by `CANONICAL_SITE_URL` in `web/`, defaulting to `https://elfilm.net`.
- `web/` remains the place for the legacy custom admin surface until that functionality is replaced or retired.
