# Cloudflare Vector Search Setup Guide

Follow these steps to enable vector search for ElFilm.

## Step 1: Create Vectorize Index

Open your terminal and run:

```bash
# Make sure you're logged in
wrangler login

# Create the vector index
wrangler vectorize create elfilm-movies --dimensions=1024 --metric=cosine
```

**Expected output:**
```
✅ Successfully created index 'elfilm-movies'
📋 Index ID: abc123def456...
```

**Important**: The index ID will be auto-configured via the binding name in `wrangler.toml`.

---

## Step 2: Verify Configuration

Your `wrangler.toml` has been updated with:

```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "elfilm-movies"

[ai]
binding = "AI"
```

This gives your Workers access to:
- **VECTORIZE**: The vector database
- **AI**: Workers AI for generating embeddings

---

## Step 3: Create D1 Database (if not done yet)

```bash
wrangler d1 create elfilm_db
```

Copy the database ID from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "elfilm_db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← Paste here
```

---

## Step 4: Run Migrations

```bash
# Create the database tables
wrangler d1 execute elfilm_db --file=migrations/001_create_schema.sql

# Import the movie data
python scripts/import_to_d1.py --db elfilm.db

# Generate SQL dump for D1
sqlite3 elfilm.db .dump > seed.sql

# Upload to D1 (will take a few minutes for 746 movies)
wrangler d1 execute elfilm_db --file=seed.sql
```

---

## Step 5: Generate Embeddings

This will create vector embeddings for all 746 movies.

### Option A: Via Worker Endpoint (Recommended)

1. Create a temporary admin endpoint in your Workers app
2. Deploy to Cloudflare
3. Call the endpoint to trigger embedding generation

**File**: `app/routes/api/admin/generate-embeddings.ts`

```typescript
import { generateAllEmbeddings } from '../../../scripts/generate_embeddings';

export async function POST(request: Request, env: Env) {
  // Add authentication check here in production!
  
  try {
    await generateAllEmbeddings(env);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

Deploy and call:
```bash
wrangler deploy

curl -X POST https://elfilm.YOUR-SUBDOMAIN.workers.dev/api/admin/generate-embeddings
```

### Option B: Via Wrangler Dev (Local Testing)

```bash
# Start local dev server
wrangler dev

# In another terminal, call the endpoint
curl -X POST http://localhost:8787/api/admin/generate-embeddings
```

**Note**: Embedding generation will take ~5-10 minutes for 746 movies (batched processing with 1s delays).

---

## Step 6: Test Semantic Search

Once embeddings are generated, test the search:

```bash
# Query endpoint with Arabic text
curl "https://elfilm.YOUR-SUBDOMAIN.workers.dev/api/vector-search?q=فيلم%20عن%20الحب%20والغيرة"

# Query endpoint with English
curl "https://elfilm.YOUR-SUBDOMAIN.workers.dev/api/vector-search?q=movie%20about%20jealousy%20in%20marriage"
```

Expected response:
```json
{
  "results": [
    {
      "id": "...",
      "title_ar": "...",
      "slug": "...",
      "year": 1948,
      "similarity": 0.87,
      ...
    }
  ]
}
```

---

## Troubleshooting

### Issue: "Vectorize index not found"

**Solution**: Make sure you created the index with the exact name:
```bash
wrangler vectorize list
```

Should show `elfilm-movies` in the list.

### Issue: "Workers AI quota exceeded"

**Solution**: You're on the free tier and hit daily limits. Either:
1. Wait 24 hours for reset
2. Upgrade to Workers Paid ($5/month) for higher limits

### Issue: "Empty search results"

**Solution**: Check that embeddings were generated:
```bash
# Check vector count
wrangler vectorize get elfilm-movies
```

Should show ~746 vectors if all movies were embedded.

---

## Next Steps

Once setup is complete:

1. **Add to movie detail page**: Show "Similar Movies" section
2. **Add semantic search bar**: Let users search by plot/theme
3. **Build discovery features**: "Find uplifting 1950s dramas"

All the repository functions are ready in `app/server/repositories/vectorSearchRepo.ts`!

---

## Cost Estimate

**With 746 movies**:
- Storage: 746 × 1024 dimensions = 764,416 dims (FREE tier: 5M limit)
- Queries: Each search = ~764K dims queried (FREE tier: 30M/month = ~40K searches)
- AI inference: Free tier daily limit, or $5/month paid

**Total: $0-5/month** depending on traffic
