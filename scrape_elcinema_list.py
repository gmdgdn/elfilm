"""
Scraper for ElCinema.com movie list
Iterates through pages of Egyptian works and filters for movies.
"""
import requests
from bs4 import BeautifulSoup
import json
import time
import random
import os

BASE_URL = "https://elcinema.com/index/work/country/eg"
OUTPUT_FILE = "elcinema_movies_list.json"

def get_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
        "Referer": "https://elcinema.com/"
    }

def scrape_list():
    movies = []
    start_page = 1
    
    # Load existing progress
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                movies = json.load(f)
                print(f"Loaded {len(movies)} existing movies.")
                # Estimate start page based on count (approx 20 items per page, but we filter)
                # Better to just start from last scraped or 1 if unsure. 
                # For safety, let's just append and deduplicate later, or start from 1 if empty.
        except:
            pass

    # We'll just iterate pages. To be robust, we could check the last movie found, 
    # but simple page iteration is easier for now. 
    # Let's assume we want to scrape ALL pages.
    
    # Find max pages first?
    # The browser check showed ~518 pages.
    MAX_PAGES = 520 
    
    for page in range(start_page, MAX_PAGES + 1):
        print(f"Scraping page {page}...")
        
        try:
            url = f"{BASE_URL}?page={page}"
            response = requests.get(url, headers=get_headers(), timeout=15)
            
            if response.status_code != 200:
                print(f"Failed to fetch page {page}: {response.status_code}")
                time.sleep(5)
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # The list items seem to be in a table or list structure.
            # Based on browser subagent, look for links to /work/
            
            # The structure is usually: 
            # <div class="row"> ... <div class="columns"> ... <ul> <li> ...
            # Let's try to find the main container.
            
            # Inspecting typical elcinema list:
            # Items are often in <ul class="photo-list-v"> or similar, OR just <div>s.
            # Let's look for the specific blocks.
            
            # Parse table rows
            rows = soup.find_all('tr')
            page_movies = []
            
            for row in rows:
                cols = row.find_all('td')
                if len(cols) >= 5:
                    # Col 0: Index
                    # Col 1: Image + Title
                    # Col 2: Type
                    # Col 3: ?
                    # Col 4: Year
                    
                    type_text = cols[2].get_text().strip()
                    
                    if "فيلم" in type_text:
                        # Extract title and URL from Col 1
                        links = cols[1].find_all('a')
                        title = ""
                        href = ""
                        
                        # Find the link with text (the title)
                        for link in links:
                            text = link.get_text().strip()
                            if text:
                                title = text
                                href = link['href']
                                break
                        
                        # Fallback: if no text link found, use the last link (might be image but we need href)
                        if not href and links:
                            href = links[-1]['href']
                            
                        if href:
                            movie_id = href.split('/')[2]
                            year = cols[4].get_text().strip()
                            
                            movie_data = {
                                "title": title,
                                "url": f"https://elcinema.com{href}",
                                "id": movie_id,
                                "year": year,
                                "source": "elcinema"
                            }
                            
                            page_movies.append(movie_data)
            
            if not page_movies:
                print(f"No movies found on page {page}.")
            else:
                print(f"  Found {len(page_movies)} movies.")
                movies.extend(page_movies)
                
                # Save periodically (Safe Write)
                if page % 5 == 0:
                    temp_file = OUTPUT_FILE + ".tmp"
                    with open(temp_file, 'w', encoding='utf-8') as f:
                        json.dump(movies, f, ensure_ascii=False, indent=2)
                    os.replace(temp_file, OUTPUT_FILE)
                    print("  Saved progress.")
            
            # Random delay
            time.sleep(random.uniform(1, 3))
            
        except Exception as e:
            print(f"Error on page {page}: {e}")
            time.sleep(5)

    # Final save
    temp_file = OUTPUT_FILE + ".tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, OUTPUT_FILE)
    print("Done!")

if __name__ == "__main__":
    scrape_list()
