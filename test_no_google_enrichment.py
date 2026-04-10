"""
Alternative enrichment strategy: Direct site scraping instead of Google search
Rather than searching Google for watch links/news, we'll scrape specific Egyptian sites directly
"""
import requests
from bs4 import BeautifulSoup
import time
import random
import json

# Install firecrawl if needed
try:
    from firecrawl import FirecrawlApp
except ImportError:
    print("Installing firecrawl...")
    import subprocess
    subprocess.run(["pip", "install", "firecrawl-py"], check=True)
    from firecrawl import FirecrawlApp

def search_youtube_arabic(query, max_results=3):
    """Search YouTube for Arabic content"""
    results = []
    try:
        # YouTube search URL (doesn't require API, just scrapes search results)
        import urllib.parse
        query_encoded = urllib.parse.quote_plus(query)
        url = f"https://www.youtube.com/results?search_query={query_encoded}"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            # Extract video IDs from the response
            import re
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

def get_movie_enrichment_no_google(movie):
    """Enrich movie WITHOUT using Google search - use direct site scraping"""
    title = movie['title']
    
    enriched = {
        "watch_links": [],
        "news": [],
        "reviews": []
    }
    
    # 1. Search YouTube directly
    youtube_query = f"{title} فيلم كامل"
    enriched["watch_links"] = search_youtube_arabic(youtube_query, max_results=3)
    
    # Random delay
    time.sleep(random.uniform(2, 4))
    
    # 2. For news, we could scrape specific Egyptian news sites
    # For now, leaving empty as this requires more specific implementation
    print(f"    Found {len(enriched['watch_links'])} watch links")
    
    return enriched

# Test with a single movie
if __name__ == "__main__":
    test_movie = {
        "title": "السرب (2023)",
        "url": "https://dhliz.com/film/alserb/"
    }
    
    print("Testing alternative enrichment (no Google)...")
    print("=" * 60)
    result = get_movie_enrichment_no_google(test_movie)
    print(json.dumps(result, ensure_ascii=False, indent=2))
