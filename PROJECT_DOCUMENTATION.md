# ElFilm Project Documentation

Version: 2026-04-09

This document provides a comprehensive, externally usable overview of the ElFilm project as it exists in the current workspace after direct code inspection on 2026-04-09. It is intended to serve as a source document for handoff, onboarding, audits, product discussions, technical reviews, and future project planning.

This document reflects the codebase and local runtime configuration that are present in the repository today. Where older status reports conflict with the code, this document prioritizes the current implementation.

## 1. Executive Summary

ElFilm is a public-facing Egyptian cinema archive and discovery platform. It combines a modern Arabic-first web frontend with a Cloudflare Workers backend that exposes archive data, semantic search, related-movie discovery, and administrative operations.

The project currently runs as a split architecture:

- `elfilm-web`: the active public frontend
- `elfilm`: the active backend and API worker
- `elfilm-site`: a deprecated Astro-based frontend retained only for reference

The live public site is:

- `https://film.gmd.gdn`

The active backend API is:

- `https://elfilm.anagmdgdn.workers.dev`

The current public experience is implemented in the `web/` directory. The backend API and archive services are implemented from the repository root with shared repository logic in `app/server/`.

## 2. Project Purpose

ElFilm is designed to make Egyptian cinema searchable, navigable, and context-rich for end users. Its primary goals are:

- provide a browsable archive of Egyptian films
- provide searchable profiles for people and companies connected to those films
- support Arabic-first discovery with right-to-left presentation
- expose semantic search for memory-driven discovery, not only exact-title search
- support editorial and archive operations through an admin console
- unify archive browsing, watch availability, and contextual discovery in a single interface

## 3. Current Production Topology

The current architecture is explicitly documented in `ARCHITECTURE.md` and confirmed by the codebase.

### Active workers

| Worker | Role | Status | Public URL / Domain | Source of truth |
| --- | --- | --- | --- | --- |
| `elfilm-web` | Public frontend | Active | `https://film.gmd.gdn` | `web/` |
| `elfilm` | API, archive backend, search backend, asset proxying | Active | `https://elfilm.anagmdgdn.workers.dev` | repository root |
| `elfilm-site` | Astro-based legacy frontend | Deprecated / frozen | `https://elfilm-site.anagmdgdn.workers.dev` | `site/` |

### Architectural rules

- All public UX work should land in `web/`.
- The public domain `film.gmd.gdn` belongs to `elfilm-web`.
- The `elfilm` backend owns D1, R2, Vectorize, AI, and archive/search responsibilities.
- `site/` is reference-only and should not receive new public-facing features.

## 4. High-Level Architecture

### Frontend layer

The public frontend is a Next.js App Router application deployed as a Cloudflare Worker via Vinext. It is frontend-only by design and communicates with the backend over HTTP.

### Backend layer

The backend is a Hono-based Cloudflare Worker that exposes:

- movie endpoints
- people endpoints
- company endpoints
- genres endpoint
- semantic vector search
- similar-movie search
- consolidated "on this day" payloads
- admin APIs
- asset delivery from R2 and static assets

### Legacy layer

The `site/` app is an Astro + EmDash-based implementation retained as a frozen reference. It is no longer the active public frontend.

### Data and media layer

The overall project also contains a large data preparation pipeline and many generated assets, seed files, intermediate databases, and enrichment outputs. These are part of the wider archive-building workflow, even though the active runtime experience is now split between `web/` and the root worker.

## 5. Repository Structure

The repository contains several logical subsystems:

| Path | Purpose |
| --- | --- |
| `web/` | Active public Next.js frontend |
| `src/` | Backend Worker entrypoint |
| `app/server/` | Backend repositories, admin routes, middleware, environment typing |
| `site/` | Deprecated Astro frontend |
| `public/` | Public static assets used by the backend worker |
| `assets/` | Downloaded or prepared media assets |
| `migrations/` | Database migration files |
| `scripts/` | Data/build helper scripts |
| `docs/` | Supporting documentation |
| root JSON / SQL / DB files | Data exports, generated seeds, local database snapshots, enrichment artifacts |

The repository is not currently a Git working tree in this workspace snapshot.

## 6. Technology Stack

## 6.1 Active public frontend stack

The active public frontend in `web/` uses:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI primitives
- shadcn-style component patterns
- Framer Motion
- Lucide icons
- Vinext for Cloudflare-compatible App Router deployment

Supporting libraries include:

- `react-hook-form`
- `zod`
- `recharts`
- `next-themes`
- `@vidstack/react`

## 6.2 Active backend stack

The active backend in the repository root uses:

- Cloudflare Workers
- Hono
- TypeScript
- Cloudflare D1
- Cloudflare R2
- Cloudflare Vectorize
- Cloudflare Workers AI

## 6.3 Legacy frontend stack

The deprecated `site/` app uses:

- Astro
- React
- Cloudflare adapter for Astro
- EmDash / `@emdash-cms/cloudflare`

## 7. Deployment and Runtime Model

## 7.1 Frontend worker

The `elfilm-web` worker is configured in `web/wrangler.jsonc`.

Bindings and vars in use:

- `ASSETS`
- `IMAGES`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ASSET_URL`

The worker entrypoint is `web/worker/index.ts`. It:

- proxies `/assets/elfilm/*` requests to the backend asset origin
- handles image optimization through the Cloudflare Images binding
- delegates App Router traffic to Vinext

## 7.2 Backend worker

The backend worker is configured in `wrangler.toml`.

Bindings in use:

- `DB`
- `R2`
- `VECTORIZE`
- `AI`
- `ASSETS`

Its entrypoint is `src/index.ts`.

## 7.3 Deployment responsibilities

Current deployment rules are documented in `DEPLOYMENT_STEPS.md` and `CLOUDFLARE_SETUP.md`.

In practice:

- deploy public site changes from `web/`
- deploy backend/API changes from the repository root
- do not deploy the public site from `site/`

## 8. Frontend Application Overview

The active frontend is an Arabic-first, right-to-left, archive-oriented web experience. It is designed to feel cinematic, editorial, and memory-driven rather than looking like a generic data table or search portal.

The public UI is built under `web/src/app/`.

### Global frontend characteristics

- `lang="ar"` at the document root
- `dir="rtl"` at the document root
- IBM Plex Sans Arabic loaded via `next/font/google`
- dark theme is the default
- theme switching is supported
- shared layout includes a global header and footer
- the homepage includes a search-forward hero with semantic search behavior

## 9. Public Route Inventory

The following pages are implemented in the active public frontend.

| Route | Type | Purpose |
| --- | --- | --- |
| `/` | static / client-enhanced | homepage, hero search, featured content, archive discovery |
| `/search` | dynamic | standalone semantic search and keyword-fallback results |
| `/on-this-day` | dynamic | births, deaths, and premieres for the current date |
| `/movies` | server-rendered | browse films with filters and pagination |
| `/movies/year/[year]` | server-rendered | year-specific movie listing |
| `/movies/[slug]` | server-rendered | movie detail page |
| `/people` | server-rendered | people listing |
| `/people/[slug]` | server-rendered | person detail page |
| `/companies` | server-rendered | company listing |
| `/companies/[slug]` | server-rendered | company detail page |
| `/genres` | server-rendered | browsing by genre and decade |
| `/watch/[slug]` | server-rendered / client-enhanced | watch-source selection and video/embed playback |
| `/admin/*` | admin | internal editorial and operational console |
| `/test` | public dev page | simple test page, likely leftover development route |

## 10. Public Page Descriptions

## 10.1 Homepage

The homepage combines several product goals:

- immediate semantic search entry
- archive identity and brand positioning
- featured movie discovery
- browse-entry shortcuts for movies, people, companies, and genres
- decade-based archive entry points
- date-based archive memory sections

Primary components include:

- `HeroSection`
- featured movie spotlight
- discovery navigation grid
- featured movie card strips
- born-on-this-day and died-on-this-day sections

## 10.2 Search page

The search page is designed for descriptive, memory-based input rather than strict exact-title input.

Capabilities:

- free-text query input
- optional year range filtering
- semantic search
- keyword fallback when vector search is unavailable
- shareable URL state through query parameters

## 10.3 On This Day page

This page aggregates a daily archive memory view:

- people born on the current date
- people who died on the current date
- movie premieres on the current date when data exists

It is backed by a consolidated backend endpoint rather than multiple independent frontend fetch patterns.

## 10.4 Movies browse and year pages

The movie archive supports:

- pagination
- sort direction
- sort field
- year range filtering
- genre filtering

The general browse page uses live genres from the backend. The year-specific page currently uses a hardcoded genre list rather than live taxonomy data.

## 10.5 Movie detail page

The movie detail page is one of the richest pages in the app. It includes:

- poster-led hero presentation
- title and alternate title display
- story / summary copy
- cast listing
- directors and writers
- crew listing
- watch links
- external articles and reviews
- related companies
- tags
- similar movie recommendations

## 10.6 People pages

The people pages provide:

- large profile presentation
- biography
- quick facts
- career period calculation
- role distribution
- full filmography organized by role type

## 10.7 Companies pages

The company pages provide:

- company profile data
- quick facts
- role distribution across productions
- associated works listing

## 10.8 Genres page

The genres page provides archive entry through:

- selected taxonomy
- selected decade
- filtered movie results

This page functions more as a browsing lens than a full taxonomy landing system.

## 10.9 Watch page

The watch experience includes:

- watch source selection
- embed support when available
- fallback to external source links when embedding is not supported
- current source metadata
- poster support
- return path to the main movie page

## 11. Admin Surface

The admin application is implemented inside the active Next app under `/admin/*`.

Primary sections:

- Overview
- Movies
- People
- Companies
- Taxonomy
- Database
- Vector Search
- Audit Log
- Settings

The admin interface uses a deliberately different visual language from the public site:

- left-to-right layout
- dashboard cards
- analytics views
- operational navigation
- "EmDash-inspired" organization around collections and operations

The admin shell is implemented in `web/src/components/admin/admin-shell.tsx`.

## 12. Design System and Visual Direction

The active public site has a clear and specific design identity.

### Core visual themes

- archive / cinema / poster culture
- strong dark-first presentation
- warm accent palette with amber-red primary tones
- large typography for mastheads
- heavy use of cinematic backdrops and overlays
- poster-driven cards for content

### Design tokens

The design system is defined through CSS custom properties in `web/src/app/globals.css`.

Key characteristics:

- semantic color tokens for background, foreground, primary, muted, accent, border, and chart colors
- light and dark theme variants
- rounded surfaces with consistent radius tokens
- reusable utility classes for archive-themed backgrounds and textures

### Visual utility patterns

Custom UI motifs include:

- `archive-frame`
- `film-strip`
- `cinema-grain`
- `poster-surface`
- `index-masthead`
- `hairline-grid`
- `poster-lift`

These utilities create a consistent archive/cinema identity across the application.

### Typography

The public site uses IBM Plex Sans Arabic as its primary font, supporting both Arabic and Latin subsets.

### Interaction and motion

The UI uses Framer Motion selectively and also includes reduced-motion handling in CSS. Focus styles are preserved globally. Hover states and poster-lift interactions are present across content cards.

## 13. Layout and Navigation

### Global layout

The root layout includes:

- sticky header
- global footer
- theme provider
- main content area

### Header navigation

Primary public navigation links:

- Search
- On This Day
- Movies
- People
- Companies
- Genres

Additional header capabilities:

- theme switching
- mobile sheet navigation
- direct CTA buttons into search and browsing

### Footer

The footer repeats the core navigation and reinforces the site's role as the official public ElFilm interface.

## 14. SEO and Metadata

SEO exists in the project, but it is currently only partially implemented.

## 14.1 Implemented SEO metadata

The global metadata in `web/src/app/layout.tsx` currently defines:

- `metadataBase`: `https://film.gmd.gdn`
- default title: `ElFilm - The Egyptian Cinema Database`
- title template: `%s | ElFilm`
- default description in Arabic describing the public archive

The document root is also correctly set to Arabic and RTL, which helps semantic and locale correctness.

Page-level metadata currently exists for:

- `/search`
- `/on-this-day`
- `/admin`

## 14.2 Robots configuration

`web/src/app/robots.ts` currently generates:

- allow: `/`
- disallow: `/api/`
- sitemap: `https://film.gmd.gdn/sitemap.xml`

Important note:

- `/admin` is not explicitly disallowed by the current robots implementation

## 14.3 Sitemap configuration

`web/src/app/sitemap.ts` currently includes only static routes:

- `/`
- `/movies`
- `/search`
- `/on-this-day`
- `/people`
- `/companies`

Important note:

- dynamic detail routes are not currently included
- the file explicitly contains a TODO to fetch dynamic routes from the API

## 14.4 Open Graph and Twitter metadata

The helper file `web/src/lib/seo.ts` includes:

- movie metadata generation
- person metadata generation
- movie schema generation
- person schema generation
- breadcrumb schema generation

These helpers support:

- Open Graph
- Twitter cards
- JSON-LD / Schema.org

However, these helpers are not currently wired into the route layer.

This means that dynamic movie and person pages do not currently appear to generate route-level metadata from live data.

## 14.5 Structured data status

Structured data helper functions exist, but there is no evidence that the application currently injects JSON-LD into the rendered pages.

## 14.6 Current SEO assessment

### Strengths

- clear site title and metadata base
- Arabic locale and RTL root semantics
- robots file exists
- sitemap exists
- metadata helper architecture exists

### Gaps

- no dynamic metadata on detail pages
- no active JSON-LD injection
- static sitemap only
- admin route not disallowed in robots
- dynamic Open Graph coverage appears incomplete

## 15. Backend API Overview

The backend entrypoint is `src/index.ts`.

The backend exposes these main public APIs:

### Movies

- `GET /api/movies`
- `GET /api/movies/search`
- `GET /api/movies/:slug`
- `GET /api/movies/:slug/similar`

### People

- `GET /api/people`
- `GET /api/people/search`
- `GET /api/people/:slug`
- `GET /api/people/born-on-this-day`
- `GET /api/people/died-on-this-day`

### Companies

- `GET /api/companies`
- `GET /api/companies/search`
- `GET /api/companies/:slug`

### Taxonomy and date-based archive

- `GET /api/genres`
- `GET /api/on-this-day`

### Search

- `GET /api/vector-search`

### Admin

- `GET /api/admin/*`
- `POST /api/admin/*`
- `PUT /api/admin/*`
- `PATCH /api/admin/*`
- `DELETE /api/admin/*`

### Assets

- `GET /assets/*`

## 16. Search Architecture

Search is one of the project's defining features.

### Public search modes

- keyword movie search
- semantic movie search
- hybrid or fallback result handling
- similar-movie retrieval

### Backend implementation

The backend uses:

- repository-based movie search
- vector search repositories
- fallback from semantic search to keyword search when needed

### Frontend behavior

The frontend search page and homepage both position search as descriptive and memory-based. This is a differentiator from simple title-only archive search.

## 17. Data Model and Content Domains

The product revolves around several primary content domains:

- Movies
- People
- Companies
- Genres
- Tags
- Assets
- Watch links
- News and external coverage
- Relationships between movies, people, companies, and taxonomy

The exact runtime schema in production may differ from older seed files because the repository contains both legacy and current schemas, plus multiple rebuild databases.

## 18. Local Database Snapshot

The local SQLite snapshot `elfilm_public.db` was inspected directly during documentation creation.

Snapshot file:

- `elfilm_public.db`

Approximate size:

- 31.74 MB

Observed table counts:

| Table | Count |
| --- | ---: |
| `movies` | 1910 |
| `people` | 20863 |
| `companies` | 1623 |
| `assets` | 10721 |
| `movie_people` | 63900 |
| `movie_genres` | 2368 |
| `movie_companies` | 4256 |
| `genres` | 22 |
| `movie_search` | 1909 |
| `watch_links` | 0 |
| `news` | 0 |
| `tags` | 0 |
| `movie_tags` | 0 |

Important interpretation note:

- this is the current local snapshot in the workspace
- it should not automatically be assumed to match production
- several older reports in the repository describe larger historical totals from earlier enrichment phases

## 19. Assets and Media Handling

The project includes a large media surface.

### Public asset handling

The backend worker serves `/assets/*` and tries:

1. R2 lookup
2. asset fallback via `ASSETS.fetch()`

Asset responses are cacheable and intended to expose archive media without exposing upstream sources directly.

### Frontend image handling

The frontend permits remote images from:

- `film.gmd.gdn`
- `elfilm.anagmdgdn.workers.dev`

Image rendering in the app commonly goes through `MediaImage`.

Important note:

- `MediaImage` currently renders images with `unoptimized`
- this means many images bypass standard Next image optimization behavior

## 20. Runtime Bindings and Environment Design

## 20.1 Backend environment

The backend environment typing in `app/server/env.ts` expects:

- `DB`
- `R2`
- `ASSETS`
- `VECTORIZE`
- `AI`
- `ADMIN_API_KEY`

## 20.2 Frontend environment

The frontend expects:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_ASSET_URL`

The admin client also uses:

- `NEXT_PUBLIC_ADMIN_API_KEY`

This is an important operational and security consideration because it suggests the browser-facing admin client may depend on a public environment variable for admin authentication.

## 21. Legacy and Transitional Code

The repository contains three notable layers of history:

### 1. Active frontend

- `web/`

### 2. Active backend

- root `src/`
- `app/server/`

### 3. Legacy frontend

- `site/`

This means the project is in a consolidation phase rather than being a single clean-slate codebase. That is normal for archive/migration projects, but it should be documented clearly for external audiences.

## 22. Current Validation Performed

The following checks were performed directly while creating this document:

- root TypeScript check: passed
- `web` TypeScript check: passed
- frontend route inventory: inspected directly
- backend route inventory: inspected directly
- local SQLite data snapshot: inspected directly

The following check did not complete within the allowed runtime:

- `web` production build via `npm run build`

Therefore:

- TypeScript health is confirmed
- full production build health is not fully confirmed from this documentation pass

## 23. Current Strengths

The current implementation is strong in several areas:

- clear split between public frontend and backend API responsibilities
- Arabic-first and RTL-aware UX
- distinctive archive/cinema visual identity
- broad route coverage for films, people, companies, search, and watch pages
- semantic search architecture already present
- backend asset-serving strategy already in place
- mature admin surface with analytics and operational tooling
- deployment documentation has already been updated to reflect the current architecture

## 24. Current Risks and Gaps

The project also has some important gaps that should be acknowledged openly.

### Product and UX gaps

- public `/test` page appears to be a leftover development route
- year-specific browse page uses hardcoded genre values
- public data completeness may differ across domains due to rebuild and migration artifacts

### SEO gaps

- dynamic detail pages do not currently appear to generate live route metadata
- JSON-LD helpers exist but are not wired into rendering
- sitemap covers only static routes
- `/admin` is not explicitly excluded in robots

### Operational gaps

- the repository contains multiple overlapping databases and generated outputs
- older status docs are stale relative to the current code
- full frontend production build status was not verified in this pass

### Security / architecture gaps

- admin client usage of `NEXT_PUBLIC_ADMIN_API_KEY` should be reviewed carefully

## 25. Recommended Next Documentation Outputs

If this project needs a broader external-ready documentation package, the following companion documents would be useful next:

- product overview
- architecture diagram
- API reference
- admin operations manual
- SEO remediation checklist
- deployment runbook
- data pipeline overview
- migration and consolidation roadmap

## 26. Recommended Immediate Technical Improvements

Based on the current state of the codebase, the most valuable next improvements would be:

1. implement `generateMetadata` on movie, person, company, watch, and other dynamic detail routes
2. inject JSON-LD for movies, people, and breadcrumbs using the existing SEO helpers
3. generate a dynamic sitemap from live route data
4. explicitly block or noindex admin routes where appropriate
5. remove or secure the `/test` route
6. replace hardcoded year-page genres with live taxonomy data
7. review admin auth design if a public environment variable is being used for privileged access
8. rationalize or document which local database snapshot is the canonical current one

## 27. Source Files Most Important for Future Maintainers

The following files are especially important for understanding the current implementation:

### Architecture and deployment

- `ARCHITECTURE.md`
- `DEPLOYMENT_STEPS.md`
- `CLOUDFLARE_SETUP.md`
- `wrangler.toml`
- `web/wrangler.jsonc`

### Public frontend

- `web/src/app/layout.tsx`
- `web/src/app/page.tsx`
- `web/src/app/search/page.tsx`
- `web/src/app/on-this-day/page.tsx`
- `web/src/app/movies/page.tsx`
- `web/src/app/movies/[slug]/page.tsx`
- `web/src/app/people/[slug]/page.tsx`
- `web/src/app/companies/[slug]/page.tsx`
- `web/src/app/watch/[slug]/page.tsx`
- `web/src/app/globals.css`
- `web/src/lib/api.ts`
- `web/src/lib/seo.ts`

### Backend

- `src/index.ts`
- `app/server/env.ts`
- `app/server/repositories/*`
- `app/server/routes/adminRoutes.ts`

### Legacy frontend

- `site/README.md`
- `site/package.json`

## 28. Final Summary

ElFilm is a serious archive product with a strong public-facing identity, a modern Cloudflare-native architecture, and meaningful differentiation through semantic search and Arabic-first design. The current codebase shows a clear transition from an older multi-frontend state toward a cleaner split between public frontend and archive backend.

From an external documentation perspective, the project is already credible and well-structured enough to present publicly. The main areas that still need polish are SEO completeness, admin/security review, and final cleanup of transitional or leftover routes and artifacts.

This document should be treated as the current external-facing technical baseline for the project as of 2026-04-09.
