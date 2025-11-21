# ElFilm API - Production Egyptian Films Database

A production-ready REST API for Egyptian films built on Cloudflare Workers, D1 (SQLite), R2 (object storage), and Cloudflare AI.

## Overview

ElFilm API provides a scalable, globally-distributed backend for querying Egyptian cinema. Features include:

### Core Features
✅ **Fast global delivery** - Cloudflare's global network
✅ **Structured queries** - Full-text search, filtering, pagination
✅ **AI-powered** - Semantic search, recommendations, summarization
✅ **Comprehensive metadata** - Films, cast, crew, genres, tags
✅ **Bilingual support** - English and Arabic content
✅ **Image storage** - R2 integration for posters and images
✅ **Analytics** - Track popular searches and user behavior

### Advanced Features
🤖 **Recommendations** - AI-powered similar films based on genres/themes
🔍 **Semantic search** - Natural language search with suggestions
📊 **Statistics** - Database-wide analytics and metadata
🎯 **Filtering** - Advanced filtering by year, genre, duration
👥 **People credits** - Actor and crew filmographies

## Technology Stack

- **Runtime**: Cloudflare Workers (V8 isolate, 50ms max CPU)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (object storage)
- **AI**: Cloudflare Workers AI (@cf/llama-2, @cf/bge)
- **Framework**: Hono (lightweight web framework)
- **Language**: TypeScript

## Project Structure

```
cf-workers/
├── src/
│   ├── index.ts              # Main worker entry point
│   ├── types.ts              # TypeScript type definitions
│   ├── db.ts                 # Database utilities
│   ├── ai.ts                 # AI integration
│   └── api/
│       └── routes.ts         # API endpoints
├── migrations/
│   ├── 0001_init_schema.sql  # D1 schema initialization
│   └── 0002_seed_elfilm.sql  # Generated from ElFilm JSON
├── scripts/
│   └── seed.js               # Database seeding script
├── wrangler.toml             # Cloudflare Workers config
├── tsconfig.json             # TypeScript config
├── package.json              # Node dependencies
└── README.md                 # This file
```

## Database Schema

### Core Tables

**films** - Main film records
- `id`, `slug`, `title_en`, `title_ar`, `production_year`, `film_type`, `duration_minutes`, `summary_ar`

**people** - Actors, directors, crew members
- `id`, `name_en`, `name_ar`, `birth_year`, `bio_en`, `bio_ar`, `image_url`, `imdb_id`

**cast** - Film → Actor relationships
- `film_id`, `person_id`, `role_name`, `imdb_rating`, `display_order`

**crew** - Film → Crew member relationships
- `film_id`, `person_id`, `crew_role_id`

**genres** - Film genres
- `id`, `name_en`, `name_ar`

**tags** - Thematic tags
- `id`, `name_en`, `name_ar`, `category`

**film_genres**, **film_tags** - Many-to-many relationships

### Analytics Tables

**search_queries** - Track all user searches
**user_ratings** - User-submitted film ratings (future feature)
**watchlist** - User watchlist management (future feature)

## API Endpoints

### Health & Status

```
GET  /health              - Service health check
GET  /stats               - Database statistics
```

### Films

```
GET  /films               - List films (paginated)
GET  /films?year=1950     - Films by production year
GET  /films/:slug         - Get single film details
GET  /films/:slug/recommendations - AI recommendations
```

### Search & Filter

```
GET  /search?q=<query>              - Full-text search (films + people)
GET  /search?q=<query>&type=film    - Search only films
GET  /filter?year_min=1950&year_max=1960&genres=1,2 - Advanced filtering
```

### Metadata

```
GET  /genres              - List all genres
GET  /years               - List production years covered
GET  /people/:id          - Get person details & filmography
```

## Installation & Setup

### Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g @cloudflare/wrangler`

### 1. Local Development

```bash
# Install dependencies
npm install

# Create D1 database
wrangler d1 create elfilm --local

# Run migrations locally
wrangler migrations apply --local

# Start development server
npm run dev
```

The API will be available at `http://localhost:8787`

### 2. Deploy to Cloudflare

```bash
# Authenticate with Cloudflare
wrangler login

# Create production D1 database
wrangler d1 create elfilm

# Update wrangler.toml with database_id

# Deploy worker
wrangler deploy

# Apply migrations
wrangler migrations apply --env production
```

### 3. Seed with ElFilm Data

```bash
# Generate seed migration from ElFilm JSON
node scripts/seed.js ../elfilm/output/elfilm_1920_2024.json

# Apply seed migration
wrangler migrations apply --env production

# Verify data
curl https://your-api.workers.dev/stats
```

## Configuration

Edit `wrangler.toml`:

```toml
# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "elfilm"
database_id = "YOUR_DATABASE_ID"

# R2 Bucket bindings
[[r2_buckets]]
binding = "POSTERS"
bucket_name = "elfilm-posters"

# Environment variables
[env.production.vars]
MAX_PAGE_SIZE = "100"
ENABLE_AI = "true"
```

## API Examples

### Get Films from Year 1950

```bash
curl "https://api.elfilm.com/films?year=1950&limit=10"
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "slug": "aakher_kedba",
      "title_en": "Aakher Kedba",
      "title_ar": "آخر كدبة",
      "production_year": 1950,
      "film_type": "Black and White",
      "duration_minutes": 115,
      "genres": ["Comedy"],
      "cast": [
        { "name_en": "Farid Al-Atrash", "imdb_rating": 8.0 }
      ],
      "crew": [
        { "name_en": "Ahmad Badrakhan", "role_name": "Director" }
      ],
      "tags_en": ["marriage", "male singer"]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "has_more": true
  }
}
```

### Search Films

```bash
curl "https://api.elfilm.com/search?q=comedy+marriage&limit=5"
```

**Response:**
```json
{
  "results": {
    "films": [
      {
        "slug": "aakher_kedba",
        "title_en": "Aakher Kedba",
        ...
      }
    ]
  },
  "pagination": { ... },
  "query": "comedy marriage",
  "suggestions": [
    "Egyptian comedy films",
    "romantic comedies",
    "marriage dramas"
  ]
}
```

### Get Film Recommendations

```bash
curl "https://api.elfilm.com/films/aakher_kedba/recommendations"
```

**Response:**
```json
{
  "film_slug": "aakher_kedba",
  "recommendations": [
    {
      "film": { "slug": "leila_banat", "title_en": "..." },
      "similarity_score": 0.85,
      "reason": "Similar genres: 1 match, 2 shared tags"
    }
  ]
}
```

### Filter by Multiple Criteria

```bash
curl "https://api.elfilm.com/filter?year_min=1945&year_max=1955&genres=1,2"
```

## Performance Optimization

### Caching

Add caching headers to `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "api.elfilm.com/*", zone_name = "elfilm.com" }
]

[[triggers.crons]]
crons = ["0 0 * * *"]  # Daily cache refresh
```

### Database Indexes

The schema includes optimized indexes:
- `idx_films_year` - Fast year-based queries
- `idx_films_slug` - Fast slug lookups
- `idx_cast_film` - Fast cast lookups
- `idx_crew_film` - Fast crew lookups

### Query Optimization

Example of optimized queries:

```typescript
// ✅ Efficient - uses index
const films = await db.getFilmsByYear(1950, 20, 0);

// ❌ Inefficient - full table scan
const films = await db.searchFilms("1950", 20, 0);
```

## AI Features

### Semantic Search

Enable Cloudflare Workers AI in `wrangler.toml`:

```toml
[[ai]]
binding = "AI"

[env.production.vars]
ENABLE_AI = "true"
```

Uses `@cf/llama-2-7b-chat-int8` for:
- Search suggestions
- Plot summarization
- Film classification
- Natural language explanations

### Embeddings

Uses `@cf/baai/bge-small-en-v1.5` for:
- Semantic similarity
- Recommendation generation
- Content deduplication

## Analytics

### Track Searches

All searches are recorded in `search_queries` table:

```sql
SELECT query, COUNT(*) as frequency
FROM search_queries
WHERE created_at > date('now', '-30 days')
GROUP BY query
ORDER BY frequency DESC
LIMIT 10;
```

### Popular Genres

```sql
SELECT g.name_en, COUNT(*) as count
FROM film_genres fg
JOIN genres g ON fg.genre_id = g.id
GROUP BY g.name_en
ORDER BY count DESC;
```

## Error Handling

All errors return standardized JSON:

```json
{
  "error": {
    "code": "404",
    "message": "Film not found",
    "details": null
  },
  "timestamp": "2024-11-21T12:00:00Z"
}
```

Error codes:
- `400` - Bad request
- `404` - Not found
- `429` - Rate limited
- `500` - Server error
- `503` - Service unavailable

## CORS & Security

### CORS

All endpoints support CORS for browser access:

```javascript
app.use('*', cors());
```

### Rate Limiting

Implement with Cloudflare Rate Limiting:

```toml
[env.production]
routes = [
  { pattern = "api.elfilm.com/*", rate_limiting = { threshold = 100, period = 60 } }
]
```

## Monitoring & Logging

### Health Endpoint

```bash
curl "https://api.elfilm.com/health"
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "services": {
    "database": "ok",
    "ai": "ok",
    "storage": "ok"
  }
}
```

### View Logs

```bash
wrangler tail --env production
```

## Future Enhancements

### Phase 2
- [ ] User authentication (OAuth)
- [ ] User ratings and reviews
- [ ] Personal watchlists
- [ ] Favorites/collections
- [ ] Email notifications

### Phase 3
- [ ] Advanced caching strategies
- [ ] Real-time search suggestions
- [ ] Film recommendation ML model
- [ ] Social features (sharing, comments)
- [ ] Mobile app API

### Phase 4
- [ ] GraphQL API
- [ ] WebSocket for real-time updates
- [ ] Advanced analytics dashboard
- [ ] Admin panel
- [ ] Content moderation tools

## Troubleshooting

### Database Connection Issues

```bash
# Test local database
wrangler d1 execute elfilm --local --command "SELECT 1"

# Test production database
wrangler d1 execute elfilm --command "SELECT COUNT(*) FROM films"
```

### AI Service Errors

Check that AI binding is configured:

```bash
wrangler deployments list
wrangler tail --env production
```

### Slow Queries

Use EXPLAIN QUERY PLAN:

```sql
EXPLAIN QUERY PLAN
SELECT * FROM films WHERE production_year = 1950;
```

## Development Workflow

### Type Checking

```bash
npm run type-check
```

### Code Formatting

```bash
npm run format
```

### Linting

```bash
npm run lint
```

### Build for Production

```bash
npm run build
npm run deploy:prod
```

## Cost Estimation

### Cloudflare Pricing (as of 2024)

- **Workers**: $0.50 per million requests + CPU time
- **D1**: $0.75 per 1M reads + $1.50 per 1M writes
- **R2**: $0.015 per GB storage + $0.36 per 1M reads
- **Workers AI**: $0.01-0.05 per 1K requests (varies by model)

### Example Monthly Cost (1M API calls)

- Workers: ~$0.50
- D1: ~$1.00
- R2: ~$0.05
- AI: ~$50 (with heavy AI usage)

**Total**: ~$51.55/month for 1M API calls + AI features

## Support & Contributing

### Issue Reporting

Report issues to the GitHub repository

### Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Include tests and documentation

## License

This project is provided for educational and production use.

## Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [Hono Documentation](https://hono.dev/)
- [Cloudflare AI Models](https://developers.cloudflare.com/workers-ai/)

---

**Ready to deploy?** Run `wrangler deploy` to get started! 🚀
