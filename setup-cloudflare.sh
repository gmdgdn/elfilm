#!/bin/bash
# Cloudflare Setup Script for ElFilm
# Run this to set up all Cloudflare infrastructure

echo "🎬 ElFilm Cloudflare Setup"
echo "========================================"

# Configuration
D1_DB_ID="0281216f-f7ac-4cc1-a516-a57a7345c216"
R2_BUCKET="elfilm-assets"
VECTORIZE_INDEX="elfilm-movies"

echo ""
echo "Step 1: Login to Cloudflare"
echo "----------------------------"
wrangler login

echo ""
echo "Step 2: Create Vectorize Index"
echo "--------------------------------"
wrangler vectorize create $VECTORIZE_INDEX --dimensions=1024 --metric=cosine

echo ""
echo "Step 3: Run D1 Migrations"
echo "-------------------------"
wrangler d1 execute elfilm_db --file=migrations/001_create_schema.sql

echo ""
echo "Step 4: Import Data to D1"
echo "-------------------------"
echo "Generating SQL dump from local database..."
sqlite3 elfilm.db .dump > seed.sql

echo "Uploading to D1 (this may take a few minutes)..."
wrangler d1 execute elfilm_db --file=seed.sql

echo ""
echo "Step 5: Verify D1 Data"
echo "----------------------"
wrangler d1 execute elfilm_db --command="SELECT COUNT(*) as movie_count FROM movies"

echo ""
echo "Step 6: Install Dependencies"
echo "----------------------------"
npm install

echo ""
echo "Step 7: Build the Application"
echo "------------------------------"
npm run build

echo ""
echo "Step 8: Deploy Worker"
echo "---------------------"
wrangler deploy

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Generate embeddings: curl -X POST https://elfilm.YOUR-SUBDOMAIN.workers.dev/api/admin/embeddings"
echo "2. Add custom domain in Cloudflare Dashboard"
echo "3. Upload assets to R2: https://pub-4a45b85f6bfb41f9b5b0c3d463c5d5d3.r2.dev"
echo ""
echo "Your worker is live at the URL shown above!"
