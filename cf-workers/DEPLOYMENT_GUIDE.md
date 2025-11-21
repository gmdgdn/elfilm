# ElFilm API Deployment Guide

Complete step-by-step guide to deploy ElFilm API to Cloudflare in production.

## Prerequisites

- Cloudflare account (free tier works, but recommended: Pro or Business)
- Domain registered and connected to Cloudflare
- Node.js 18+ installed
- Wrangler CLI: `npm install -g @cloudflare/wrangler@latest`

## Step 1: Prepare Your Environment

### 1.1 Clone and Setup

```bash
cd cf-workers
npm install
npm run type-check  # Verify TypeScript compiles
```

### 1.2 Authenticate with Cloudflare

```bash
wrangler login
# This opens a browser to authenticate and saves credentials
```

Verify authentication:
```bash
wrangler whoami
```

## Step 2: Create D1 Database

### 2.1 Create Production Database

```bash
wrangler d1 create elfilm
```

Output will show:
```
✓ Created new D1 database 'elfilm'
✓ Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 2.2 Update wrangler.toml

Open `wrangler.toml` and update the D1 binding:

```toml
[[d1_databases]]
binding = "DB"
database_name = "elfilm"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Paste your ID here
```

### 2.3 Apply Schema Migrations

```bash
# Apply schema creation
wrangler migrations apply --env production --remote

# Verify migrations were applied
wrangler d1 execute elfilm --command "SELECT name FROM sqlite_master WHERE type='table';" --remote
```

Expected output shows tables: `films`, `people`, `cast`, `crew`, `genres`, `tags`, etc.

## Step 3: Prepare ElFilm Data

### 3.1 Generate Seed Migration

From the `elfilm` directory:

```bash
# Generate seed migration from ElFilm JSON
cd ../elfilm
python -m elfilm.main 1950 1960  # or your desired year range
# This creates: output/elfilm_1950_1960.json

# Go back to cf-workers
cd ../cf-workers

# Generate seed SQL
node scripts/seed.js ../elfilm/output/elfilm_1950_1960.json
```

This creates: `migrations/0002_seed_elfilm.sql`

### 3.2 Apply Seed Migration

```bash
# Apply to production database
wrangler migrations apply --env production --remote

# Verify data was loaded
wrangler d1 execute elfilm --command "SELECT COUNT(*) as film_count FROM films;" --remote
```

You should see the count of films from your dataset.

## Step 4: Configure R2 Buckets (Optional)

### 4.1 Create R2 Buckets

```bash
# For film posters
wrangler r2 bucket create elfilm-posters

# For other images
wrangler r2 bucket create elfilm-images
```

### 4.2 Update wrangler.toml

```toml
[[r2_buckets]]
binding = "POSTERS"
bucket_name = "elfilm-posters"

[[r2_buckets]]
binding = "IMAGES"
bucket_name = "elfilm-images"
```

## Step 5: Configure Custom Domain (Optional)

### 5.1 Setup Subdomain

In Cloudflare dashboard:

1. Go to your domain → DNS
2. Create new CNAME record:
   - Name: `api`
   - Target: `your-worker-subdomain.workers.dev`
3. Enable Cloudflare proxy (orange cloud)

### 5.2 Update wrangler.toml

```toml
[env.production]
routes = [
  { pattern = "api.yourdomain.com/*", zone_id = "YOUR_ZONE_ID" }
]
```

Get zone ID from domain → Settings → Advanced.

## Step 6: Deploy Worker

### 6.1 Build and Deploy

```bash
npm run build
wrangler deploy --env production
```

Output:
```
✓ Uploaded elfilm-api
✓ Deployed to https://elfilm-api-prod.your-subdomain.workers.dev
```

### 6.2 Verify Deployment

```bash
# Test health endpoint
curl https://your-api-url.workers.dev/health

# Should return:
# { "status": "healthy", "services": { "database": "ok", ... } }
```

## Step 7: Enable AI (Optional)

### 7.1 Update wrangler.toml

```toml
[[ai]]
binding = "AI"

[env.production.vars]
ENABLE_AI = "true"
```

### 7.2 Redeploy

```bash
wrangler deploy --env production
```

### 7.3 Test AI Features

```bash
# Get recommendations
curl "https://your-api-url.workers.dev/films/aakher_kedba/recommendations"

# Test search with suggestions
curl "https://your-api-url.workers.dev/search?q=egyptian+comedy"
```

## Step 8: Setup Monitoring & Analytics

### 8.1 Enable Tail Logs

```bash
wrangler tail --env production
```

Keep this running to see real-time requests and errors.

### 8.2 Setup CloudflarePages Analytics

1. In Cloudflare dashboard → Workers & Pages
2. Select your worker
3. Go to Analytics tab
4. View requests, errors, CPU time

### 8.3 Setup Custom Analytics Dashboard

The API records all searches in D1:

```bash
# Check popular searches
wrangler d1 execute elfilm --command "
SELECT query, COUNT(*) as frequency
FROM search_queries
WHERE created_at > date('now', '-7 days')
GROUP BY query
ORDER BY frequency DESC
LIMIT 10;
" --remote
```

## Step 9: Setup Auto-Scaling & Rate Limiting

### 9.1 Enable Rate Limiting

In Cloudflare dashboard → Security → Rate Limiting:

1. Create new rate limiting rule
2. URL: `api.yourdomain.com/*`
3. Threshold: 100 requests per 60 seconds
4. Action: Block

### 9.2 Setup DDoS Protection

1. Go to Security → DDoS Protection
2. Choose sensitivity: Medium
3. Enable Bot Fight Mode

## Step 10: Testing in Production

### 10.1 Smoke Tests

```bash
BASE_URL="https://your-api-url.workers.dev"

# Test health
curl $BASE_URL/health

# Test statistics
curl $BASE_URL/stats

# Test listing films
curl "$BASE_URL/films?limit=5"

# Test search
curl "$BASE_URL/search?q=comedy"

# Test filtering
curl "$BASE_URL/filter?year_min=1950&year_max=1960"

# Test single film
curl "$BASE_URL/films/aakher_kedba"

# Test recommendations (if AI enabled)
curl "$BASE_URL/films/aakher_kedba/recommendations"
```

### 10.2 Performance Testing

```bash
# Test with ab (Apache Bench)
ab -n 100 -c 10 https://your-api-url.workers.dev/films

# Test with wrk
wrk -t4 -c100 -d30s https://your-api-url.workers.dev/films
```

Expected performance:
- Response time: < 100ms
- Throughput: > 1000 req/sec
- Error rate: < 0.1%

## Step 11: Setup CI/CD (Optional)

### 11.1 GitHub Actions Deployment

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
    paths:
      - 'cf-workers/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: cf-workers
        run: npm install

      - name: Build
        working-directory: cf-workers
        run: npm run build

      - name: Deploy
        working-directory: cf-workers
        run: npm run deploy:prod
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 11.2 Add Secrets to GitHub

1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add `CLOUDFLARE_API_TOKEN` (from Cloudflare dashboard)
3. Add `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare dashboard)

## Step 12: Production Checklist

Before going fully live:

- [ ] All API endpoints responding correctly
- [ ] Search functionality working
- [ ] AI features enabled (if using)
- [ ] Monitoring/logging setup
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Error handling tested
- [ ] Performance tested (> 1000 req/sec)
- [ ] Database backups configured
- [ ] Cost monitoring enabled

## Rollback Plan

### If Something Goes Wrong

```bash
# Revert to previous worker version
wrangler rollback --env production

# Or redeploy a known-good version
wrangler deploy --env production

# Check status
wrangler deployments list --env production
```

## Maintenance

### Regular Tasks

```bash
# Weekly: Check logs
wrangler tail --env production --limit 100

# Monthly: Review analytics
# Go to Cloudflare dashboard → Analytics

# As needed: Apply updates
git pull
npm install
npm run build
npm run deploy:prod
```

### Database Maintenance

```bash
# Monthly: Vacuum database (optimize storage)
wrangler d1 execute elfilm --command "VACUUM;" --remote

# Quarterly: Update statistics
wrangler d1 execute elfilm --command "ANALYZE;" --remote
```

## Support

### Troubleshooting

**API returning 500 errors:**
```bash
wrangler tail --env production
# Check logs for database errors
```

**Slow queries:**
```bash
# Check slow query log
wrangler d1 execute elfilm --command "SELECT COUNT(*) FROM search_queries;" --remote
```

**AI features not working:**
```bash
# Verify AI binding
wrangler deployments list --env production

# Check that ENABLE_AI is true
wrangler secret list --env production
```

## Next Steps

After deployment:

1. ✅ Test all endpoints thoroughly
2. ✅ Monitor for 24 hours
3. ✅ Setup automated backups
4. ✅ Configure custom domain/SSL
5. ✅ Add documentation to team
6. ✅ Setup alerts for errors
7. ✅ Plan scaling strategy

## Cost Optimization

To reduce costs:

1. Disable AI if not used (saves ~$50/month)
2. Set lower limits on pagination
3. Use R2 only if serving images
4. Implement aggressive caching

Example cost-optimized setup:
- Workers only: $5/month
- D1 with moderate usage: $10/month
- R2 disabled: $0/month
- AI disabled: $0/month
- **Total: ~$15/month**

## Further Reading

- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 Best Practices](https://developers.cloudflare.com/d1/best-practices/)
- [R2 Optimization](https://developers.cloudflare.com/r2/)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models-list/)

---

**Happy deploying!** 🚀
