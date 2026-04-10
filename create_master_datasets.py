"""
Comprehensive Data Merge Script
Creates final unified datasets:
1. movies_master.json - All movies from all sources
2. people_master.json - Copy of fully enriched people (already complete)
"""
import json
import os
from collections import defaultdict
import unicodedata
import re

print("=" * 70)
print("COMPREHENSIVE DATA MERGE - FINAL UNIFIED DATASETS")
print("=" * 70)

# Normalize text for fuzzy matching
def normalize_title(title):
    """Normalize Arabic title for better matching"""
    if not title:
        return ""
    
    # Remove diacritics
    title = ''.join(c for c in unicodedata.normalize('NFD', title)
                    if unicodedata.category(c) != 'Mn')
    
    # Normalize common variations
    title = title.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
    title = title.replace('ة', 'ه')
    title = title.replace('ى', 'ي')
    
    # Remove punctuation and extra spaces
    title = re.sub(r'[^\w\s]', '', title)
    title = ' '.join(title.split())
    
    return title.strip().lower()

# STEP 1: Load all data sources
print("\n📂 STEP 1: Loading all data sources...")
print("-" * 70)

# Load movies_unified (base dataset)
with open('movies_unified.json', 'r', encoding='utf-8') as f:
    unified_movies = json.load(f)
print(f"✅ Loaded {len(unified_movies)} movies from movies_unified.json")

# Load Exa enriched movies
with open('movies_exa_enriched_full.json', 'r', encoding='utf-8') as f:
    exa_movies = json.load(f)
print(f"✅ Loaded {len(exa_movies)} movies from movies_exa_enriched_full.json")

# Load ElCinema details
with open('elcinema_movies_details.json', 'r', encoding='utf-8') as f:
    elcinema_movies = json.load(f)
print(f"✅ Loaded {len(elcinema_movies)} movies from elcinema_movies_details.json")

# Load people (already complete)
with open('people_exa_enriched.json', 'r', encoding='utf-8') as f:
    people = json.load(f)
print(f"✅ Loaded {len(people)} people from people_exa_enriched.json")

# STEP 2: Create lookup dictionaries
print("\n🔍 STEP 2: Creating lookup dictionaries...")
print("-" * 70)

# Create Exa lookup (by title)
exa_lookup = {}
for movie in exa_movies:
    title = movie.get('title', '')
    if title:
        norm_title = normalize_title(title)
        exa_lookup[norm_title] = movie

print(f"✅ Created Exa lookup with {len(exa_lookup)} entries")

# Create ElCinema lookup (by title + year for better matching)
elcinema_lookup = {}
elcinema_by_id = {}
for movie in elcinema_movies:
    title = movie.get('title', '')
    year = movie.get('year', '')
    movie_id = movie.get('id', '')
    
    if title:
        norm_title = normalize_title(title)
        key = f"{norm_title}_{year}" if year else norm_title
        
        if key not in elcinema_lookup:
            elcinema_lookup[key] = movie
    
    if movie_id:
        elcinema_by_id[movie_id] = movie

print(f"✅ Created ElCinema lookup with {len(elcinema_lookup)} entries")

# STEP 3: Merge all movies
print("\n🔀 STEP 3: Merging all movie data...")
print("-" * 70)

master_movies = []
processed_elcinema_ids = set()
stats = {
    'total_unique': 0,
    'from_unified': 0,
    'enriched_from_exa': 0,
    'enriched_from_elcinema': 0,
    'new_from_elcinema': 0
}

# Process each movie from unified dataset
for movie in unified_movies:
    title = movie.get('title', '')
    year = movie.get('year', '')
    norm_title = normalize_title(title)
    
    # Start with unified movie data
    merged_movie = dict(movie)
    
    # Merge Exa enrichment if available
    if norm_title in exa_lookup:
        exa_data = exa_lookup[norm_title]
        merged_movie['news'] = exa_data.get('news', [])
        merged_movie['reviews'] = exa_data.get('reviews', [])
        merged_movie['_enriched_exa'] = True
        stats['enriched_from_exa'] += 1
    
    # Merge ElCinema data if available
    elcinema_key = f"{norm_title}_{year}" if year else norm_title
    if elcinema_key in elcinema_lookup:
        elcinema_data = elcinema_lookup[elcinema_key]
        
        # Enrich with ElCinema data if better/missing
        if not merged_movie.get('story') and elcinema_data.get('story'):
            merged_movie['story'] = elcinema_data['story']
        
        if not merged_movie.get('genres') and elcinema_data.get('genres'):
            merged_movie['genres'] = elcinema_data['genres']
        
        if not merged_movie.get('poster_url') and elcinema_data.get('poster_url'):
            merged_movie['poster_url'] = elcinema_data['poster_url']
        
        if not merged_movie.get('cast') and elcinema_data.get('cast'):
            merged_movie['cast'] = elcinema_data['cast']
        
        if not merged_movie.get('crew') and elcinema_data.get('crew'):
            merged_movie['crew'] = elcinema_data['crew']
        
        merged_movie['_enriched_elcinema'] = True
        processed_elcinema_ids.add(elcinema_data.get('id'))
        stats['enriched_from_elcinema'] += 1
    
    # Add source tracking
    merged_movie['_sources'] = []
    if movie.get('source'):
        merged_movie['_sources'].append(movie['source'])
    if merged_movie.get('_enriched_exa'):
        merged_movie['_sources'].append('exa')
    if merged_movie.get('_enriched_elcinema'):
        merged_movie['_sources'].append('elcinema')
    
    master_movies.append(merged_movie)
    stats['from_unified'] += 1

print(f"✅ Processed {len(master_movies)} movies from unified dataset")

# Add remaining ElCinema movies not in unified
for movie in elcinema_movies:
    movie_id = movie.get('id')
    if movie_id and movie_id not in processed_elcinema_ids:
        title = movie.get('title', '')
        norm_title = normalize_title(title)
        
        # Copy ElCinema movie
        new_movie = dict(movie)
        
        # Try to add Exa enrichment
        if norm_title in exa_lookup:
            exa_data = exa_lookup[norm_title]
            new_movie['news'] = exa_data.get('news', [])
            new_movie['reviews'] = exa_data.get('reviews', [])
            new_movie['_enriched_exa'] = True
        
        new_movie['_sources'] = ['elcinema']
        if new_movie.get('_enriched_exa'):
            new_movie['_sources'].append('exa')
        
        master_movies.append(new_movie)
        stats['new_from_elcinema'] += 1

print(f"✅ Added {stats['new_from_elcinema']} new movies from ElCinema")

stats['total_unique'] = len(master_movies)

# STEP 4: Save master datasets
print("\n💾 STEP 4: Saving master datasets...")
print("-" * 70)

# Save movies master
with open('movies_master.json.tmp', 'w', encoding='utf-8') as f:
    json.dump(master_movies, f, ensure_ascii=False, indent=2)
os.replace('movies_master.json.tmp', 'movies_master.json')
print(f"✅ Saved {len(master_movies)} movies to movies_master.json")

# Save people master (copy of fully enriched)
with open('people_master.json.tmp', 'w', encoding='utf-8') as f:
    json.dump(people, f, ensure_ascii=False, indent=2)
os.replace('people_master.json.tmp', 'people_master.json')
print(f"✅ Saved {len(people)} people to people_master.json")

# STEP 5: Generate statistics
print("\n📊 STEP 5: Final Statistics")
print("=" * 70)

print(f"""
MOVIES DATASET:
  Total Unique Movies:           {stats['total_unique']:,}
  From Unified (Dhliz):          {stats['from_unified']:,}
  New from ElCinema:             {stats['new_from_elcinema']:,}
  
ENRICHMENT COVERAGE:
  With Exa Enrichment:           {stats['enriched_from_exa']:,} ({stats['enriched_from_exa']/stats['total_unique']*100:.1f}%)
  With ElCinema Data:            {stats['enriched_from_elcinema']:,} ({stats['enriched_from_elcinema']/stats['total_unique']*100:.1f}%)

PEOPLE DATASET:
  Total People:                  {len(people):,}
  Fully Exa Enriched:            {len(people):,} (100%)

OUTPUT FILES:
  movies_master.json             {os.path.getsize('movies_master.json') / 1024 / 1024:.1f} MB
  people_master.json             {os.path.getsize('people_master.json') / 1024 / 1024:.1f} MB
""")

# Save statistics
final_stats = {
    "created": "2025-11-22 11:31",
    "movies": {
        "total": stats['total_unique'],
        "from_unified": stats['from_unified'],
        "new_from_elcinema": stats['new_from_elcinema'],
        "with_exa": stats['enriched_from_exa'],
        "with_elcinema": stats['enriched_from_elcinema'],
        "exa_coverage_pct": round(stats['enriched_from_exa']/stats['total_unique']*100, 2),
        "elcinema_coverage_pct": round(stats['enriched_from_elcinema']/stats['total_unique']*100, 2)
    },
    "people": {
        "total": len(people),
        "exa_enriched": len(people),
        "coverage_pct": 100.0
    }
}

with open('final_statistics.json', 'w', encoding='utf-8') as f:
    json.dump(final_stats, f, ensure_ascii=False, indent=2)

print("✅ Saved statistics to final_statistics.json")

print("\n" + "=" * 70)
print("✅ MERGE COMPLETE!")
print("=" * 70)
