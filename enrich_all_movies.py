import json
import os
import time
import requests
from bs4 import BeautifulSoup
import urllib.parse
import glob

def search_youtube_direct(query, max_results=3):
    """Search YouTube directly without Google - scrapes YouTube search results"""
    import re
    results = []
    try:
        query_encoded = urllib.parse.quote_plus(query)
        url = f"https://www.youtube.com/results?search_query={query_encoded}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            # Extract video IDs from the response
            video_ids = re.findall(r'"videoId":"([^"]+)"', response.text)
            
            for vid_id in video_ids[:max_results]:
                if vid_id:
                    results.append({
                        "platform": "youtube",
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "title": query
                    })
    except Exception as e:
        print(f"    YouTube search error: {e}")
    
    return results

def enrich_movie(movie):
    """Enrich a single movie with watch links (YouTube only, no Google to avoid rate limiting)."""
    title = movie['title']
    
    # 1. Watch Links - YouTube Direct Search (no Google)
    watch_query = f"{title} فيلم كامل"
    watch_links = search_youtube_direct(watch_query, max_results=3)
    movie['watch_links'] = watch_links
    
    # 2. News - Skip for now (would need specific Egyptian news site scraping)
    movie['news'] = []
    
    # 3. Reviews - Skip for now (would need specific review site scraping)
    movie['reviews'] = []
    
    return movie

def enrich_all_movies():
    """Enrich all movie files from 1920-2025."""
    # Find all movie detail files
    movie_files = sorted(glob.glob("movies_*_details.json"))
    
    print(f"Found {len(movie_files)} movie files to enrich")
    
    for movie_file in movie_files:
        # Skip if enriched version already exists
        enriched_file = movie_file.replace("_details.json", "_enriched.json")
        
        # Load existing enriched if available, otherwise start fresh
        if os.path.exists(enriched_file):
            print(f"\n✓ {enriched_file} already exists, skipping...")
            continue
            
        print(f"\n📽️  Processing {movie_file}...")
        
        with open(movie_file, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        print(f"  Enriching {len(movies)} movies...")
        
        for i, movie in enumerate(movies):
            title = movie['title']
            print(f"  [{i+1}/{len(movies)}] {title}")
            
            try:
                movie = enrich_movie(movie)
                # Save periodically (every 5 movies)
                if (i + 1) % 5 == 0:
                    with open(enriched_file, 'w', encoding='utf-8') as f:
                        json.dump(movies, f, ensure_ascii=False, indent=2)
                    print(f"    💾 Saved progress...")
                
                # Random delay to avoid detection (5-10 seconds)
                import random
                time.sleep(random.uniform(5, 10))
            except Exception as e:
                print(f"    ⚠️  Error: {e}")
                continue
        
        # Final save
        with open(enriched_file, 'w', encoding='utf-8') as f:
            json.dump(movies, f, ensure_ascii=False, indent=2)
        
        print(f"  ✅ Saved {enriched_file}")
        print(f"  Waiting 10 seconds before next file...")
        time.sleep(10)

if __name__ == "__main__":
    enrich_all_movies()
    print("\n🎬 All movies enriched!")
