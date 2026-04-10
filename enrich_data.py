import json
import os
import time
import requests
from bs4 import BeautifulSoup
import urllib.parse

def search_google(query, num_results=5):
    # Note: This is a basic scraper. For production/scale, use Custom Search JSON API.
    # We will use a user-agent to mimic a browser, but be aware of rate limits.
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    query = urllib.parse.quote_plus(query)
    url = f"https://www.google.com/search?q={query}&num={num_results}"
    
    results = []
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            for g in soup.find_all('div', class_='g'):
                anchors = g.find_all('a')
                if anchors:
                    link = anchors[0]['href']
                    title = g.find('h3')
                    if title:
                        title = title.text
                    else:
                        title = link
                        
                    snippet = g.find('div', class_='VwiC3b') # Common class for snippets, might change
                    snippet_text = snippet.text if snippet else ""
                    
                    results.append({
                        "title": title,
                        "link": link,
                        "snippet": snippet_text
                    })
    except Exception as e:
        print(f"Search error: {e}")
        
    return results

def enrich_movies():
    # Load movies (using 2023 as a test batch first)
    input_file = "movies_2023_details.json"
    if not os.path.exists(input_file):
        print(f"{input_file} not found.")
        return
        
    with open(input_file, 'r', encoding='utf-8') as f:
        movies = json.load(f)
        
    print(f"Enriching {len(movies)} movies from {input_file}...")
    
    for i, movie in enumerate(movies):
        title = movie['title']
        print(f"[{i+1}/{len(movies)}] Searching for: {title}")
        
        # 1. Watch Links
        watch_query = f"مشاهدة فيلم {title} كامل"
        search_results = search_google(watch_query, num_results=5)
        
        watch_links = []
        for res in search_results:
            link = res['link']
            if "youtube.com" in link or "dailymotion.com" in link or "shahid" in link or "watchit" in link:
                platform = "unknown"
                if "youtube" in link: platform = "youtube"
                elif "dailymotion" in link: platform = "dailymotion"
                elif "shahid" in link: platform = "shahid"
                elif "watchit" in link: platform = "watchit"
                
                watch_links.append({
                    "platform": platform,
                    "url": link,
                    "title": res['title']
                })
        
        movie['watch_links'] = watch_links
        
        # 2. News
        news_query = f"أخبار فيلم {title}"
        news_results = search_google(news_query, num_results=3)
        movie['news'] = news_results
        
        # Be nice to Google
        time.sleep(2) 
        
    # Save enriched
    output_file = "movies_2023_enriched.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
        
    print(f"Saved enriched data to {output_file}")

if __name__ == "__main__":
    enrich_movies()
