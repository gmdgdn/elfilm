# Cloudflare Setup Script for ElFilm (Windows PowerShell)
# Run this to set up all Cloudflare infrastructure

Write-Host "🎬 ElFilm Cloudflare Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Configuration
$D1_DB_ID = "0281216f-f7ac-4cc1-a516-a57a7345c216"
$R2_BUCKET = "elfilm-assets"
$VECTORIZE_INDEX = "elfilm-movies"

Write-Host ""
Write-Host "Step 1: Login to Cloudflare" -ForegroundColor Yellow
Write-Host "----------------------------"
wrangler login

Write-Host ""
Write-Host "Step 2: Create Vectorize Index" -ForegroundColor Yellow
Write-Host "--------------------------------"
wrangler vectorize create $VECTORIZE_INDEX --dimensions=1024 --metric=cosine

Write-Host ""
Write-Host "Step 3: Run D1 Migrations" -ForegroundColor Yellow
Write-Host "-------------------------"
wrangler d1 execute elfilm_db --file=migrations/001_create_schema.sql

Write-Host ""
Write-Host "Step 4: Import Data to D1" -ForegroundColor Yellow
Write-Host "-------------------------"
Write-Host "Generating SQL dump from local database..."
sqlite3 elfilm.db .dump > seed.sql

Write-Host "Uploading to D1 (this may take a few minutes)..."
wrangler d1 execute elfilm_db --file=seed.sql

Write-Host ""
Write-Host "Step 5: Verify D1 Data" -ForegroundColor Yellow
Write-Host "----------------------"
wrangler d1 execute elfilm_db --command="SELECT COUNT(*) as movie_count FROM movies"

Write-Host ""
Write-Host "Step 6: Install Dependencies" -ForegroundColor Yellow
Write-Host "----------------------------"
npm install

Write-Host ""
Write-Host "Step 7: Build the Application" -ForegroundColor Yellow
Write-Host "------------------------------"
npm run build

Write-Host ""
Write-Host "Step 8: Deploy Worker" -ForegroundColor Yellow
Write-Host "---------------------"
wrangler deploy

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Generate embeddings: curl -X POST https://elfilm.YOUR-SUBDOMAIN.workers.dev/api/admin/embeddings"
Write-Host "2. Add custom domain in Cloudflare Dashboard"
Write-Host "3. Upload assets to R2: https://pub-4a45b85f6bfb41f9b5b0c3d463c5d5d3.r2.dev"
Write-Host ""
Write-Host "Your worker is live at the URL shown above!"
