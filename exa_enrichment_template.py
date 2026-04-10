"""
Second-pass enrichment using Exa API for news, reviews, and biographical data
Run this on the unified dataset

Exa API Documentation: https://docs.exa.ai/
"""
import json
import os
from exa_py import Exa
import time

# Load API key
EXA_API_KEY = "82ab2cb5-15ee-42d3-af3f-a5451bb725c4"

exa = Exa(api_key=EXA_API_KEY)

INPUT_FILE = "movies_unified.json"
OUTPUT_FILE = "movies_exa_enriched_full.json"

def enrich_movie_with_exa(movie):
    """Add news and reviews to a movie using Exa search"""
    title = movie.get('title', '')
    year = movie.get('year', '')
    
    if not title:
        return movie
    
    # Search for news articles about the movie
    search_query = f"{title} فيلم"
    if year:
        search_query += f" {year}"
    search_query += " أخبار"
    
    print(f"  Searching for news: {search_query}")
    news_results = exa.search_and_contents(
        search_query,
        type="auto",
        num_results=3,
        text={"max_characters": 200}
    )
    
    movie['news'] = [
        {
            "title": r.title or "",
            "link": r.url or "",
            "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
        }
        for r in news_results.results
    ]
    
    # Search for reviews
    review_query = f"{title} فيلم"
    if year:
        review_query += f" {year}"
    review_query += " تقييم مراجعة"
    
    print(f"  Searching for reviews: {review_query}")
    review_results = exa.search_and_contents(
        review_query,
        type="auto",
        num_results=2,
        text={"max_characters": 200}
    )
    
    movie['reviews'] = [
        {
            "title": r.title or "",
            "link": r.url or "",
            "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
        }
        for r in review_results.results
    ]
    
    time.sleep(1)  # Rate limiting
    return movie

if __name__ == "__main__":
    print("Starting Exa enrichment...")
    
    # Load unified movies
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)
    
    print(f"Loaded {len(movies)} movies from {INPUT_FILE}")
    
    # Load existing enriched movies to resume
    enriched_movies = []
    enriched_ids = set()
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_movies = json.load(f)
                enriched_ids = {m.get('id', m.get('title')) for m in enriched_movies}
                print(f"Resuming from {len(enriched_movies)} already enriched movies")
        except:
            print("Starting fresh enrichment")
    
    # Enrich movies
    for i, movie in enumerate(movies):
        movie_id = movie.get('id', movie.get('title'))
        
        # Skip if already enriched
        if movie_id in enriched_ids:
            continue
            
        print(f"\n[{len(enriched_movies)+1}/{len(movies)}] Enriching: {movie.get('title', 'Unknown')}")
        
        enriched = enrich_movie_with_exa(movie)
        enriched_movies.append(enriched)
        enriched_ids.add(movie_id)
        
        # Save progress every 10 movies
        if len(enriched_movies) % 10 == 0:
            temp_file = OUTPUT_FILE + ".tmp"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(enriched_movies, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, OUTPUT_FILE)
            print(f"  Saved progress: {len(enriched_movies)} movies")
    
    # Final save
    temp_file = OUTPUT_FILE + ".tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_movies, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, OUTPUT_FILE)
    
    print(f"\nDone! Enriched {len(enriched_movies)} movies")
    print(f"Saved to {OUTPUT_FILE}")

