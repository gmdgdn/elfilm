"""
Scraper for ElCinema.com movie details
Visits each movie URL from the list and extracts detailed info.
"""
import requests
from bs4 import BeautifulSoup
import json
import time
import random
import os

LIST_FILE = "elcinema_movies_list.json"
OUTPUT_FILE = "elcinema_movies_details.json"

def get_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
        "Referer": "https://elcinema.com/"
    }

def scrape_details():
    if not os.path.exists(LIST_FILE):
        print("List file not found. Run scrape_elcinema_list.py first.")
        return

    with open(LIST_FILE, 'r', encoding='utf-8') as f:
        movies_list = json.load(f)
    
    print(f"Loaded {len(movies_list)} movies to scrape.")
    
    enriched_movies = []
    scraped_ids = set()
    
    # Load existing progress
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_movies = json.load(f)
                scraped_ids = {m['id'] for m in enriched_movies}
                print(f"Resuming. Already scraped {len(enriched_movies)} movies.")
        except Exception as e:
            print(f"Could not load existing file: {e}")
            pass
            
    count_to_scrape = len([m for m in movies_list if m['id'] not in scraped_ids])
    print(f"Need to scrape {count_to_scrape} more movies")
            
    for i, movie in enumerate(movies_list):
        if movie['id'] in scraped_ids:
            continue
            
        print(f"[{i+1}/{len(movies_list)}] Scraping {movie['title']}...")
        
        try:
            url = movie['url']
            response = requests.get(url, headers=get_headers(), timeout=15)
            
            if response.status_code != 200:
                print(f"  Failed to fetch {url}: {response.status_code}")
                time.sleep(5)
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract Details
            
            # Poster (Try Meta Tag first)
            poster_url = ""
            og_image = soup.find('meta', property='og:image')
            if og_image:
                poster_url = og_image.get('content')
            
            # Story
            story = ""
            intro_div = soup.find('div', class_='intro-box')
            if intro_div:
                # Try to find the specific paragraph for story, usually before the cast list
                # Or just get text and clean it up
                paragraphs = intro_div.find_all('p')
                for p in paragraphs:
                    text = p.get_text().strip()
                    if len(text) > 20 and "طاقم العمل" not in text:
                        story = text
                        break
            
            # Genres
            genres = []
            genre_links = soup.find_all('a', href=lambda x: x and '/index/work/genre/' in x)
            genres = [g.get_text().strip() for g in genre_links]
            
            # Cast & Crew (Fetch Cast Page)
            cast = []
            crew = []
            
            try:
                cast_url = url.rstrip('/') + "/cast"
                print(f"  Fetching cast: {cast_url}")
                cast_response = requests.get(cast_url, headers=get_headers(), timeout=10)
                
                if cast_response.status_code == 200:
                    cast_soup = BeautifulSoup(cast_response.content, 'html.parser')
                    
                    # ElCinema Cast Page Structure:
                    # Usually sections for "Cast" (طاقم العمل) and "Crew" (إخراج, تأليف, etc.)
                    # They are often in grid-5 or similar classes.
                    
                    # Find all person entries
                    # Structure: <li> ... <a href="/person/123/">Name</a> ... </li>
                    
                    # We need to distinguish Cast vs Crew.
                    # Usually headers like "تمثيل" (Acting) vs "إخراج" (Directing)
                    
                    # Let's just grab everyone and their role if possible.
                    # Or look for specific sections.
                    
                    # Simplified approach: Grab all people with their roles
                    # The structure is often:
                    # <div class="panel"> <h3>Role Name</h3> <ul> <li> Person </li> ... </ul> </div>
                    
                    panels = cast_soup.find_all('div', class_='panel')
                    for panel in panels:
                        role_header = panel.find('h3')
                        role_name = role_header.get_text().strip() if role_header else "Unknown"
                        
                        persons = panel.find_all('li')
                        for p in persons:
                            link = p.find('a', href=True)
                            if link and '/person/' in link['href']:
                                name = link.get_text().strip()
                                p_id = link['href'].split('/')[2]
                                
                                # Image
                                img = p.find('img')
                                image_url = img.get('src') or img.get('data-src') if img else ""
                                
                                person_data = {
                                    "id": p_id,
                                    "name": name,
                                    "role": role_name,
                                    "image_url": image_url
                                }
                                
                                if "تمثيل" in role_name or "Cast" in role_name:
                                    cast.append(person_data)
                                else:
                                    crew.append(person_data)
                                    
            except Exception as e:
                print(f"  Error fetching cast: {e}")
            
            movie['poster_url'] = poster_url
            movie['story'] = story
            movie['genres'] = genres
            movie['cast'] = cast
            movie['crew'] = crew
            
            enriched_movies.append(movie)
            scraped_ids.add(movie['id'])
            
            # Save periodically
            if len(enriched_movies) % 10 == 0:
                with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                    json.dump(enriched_movies, f, ensure_ascii=False, indent=2)
                print("  Saved progress.")
                
            time.sleep(random.uniform(1, 3))
            
        except Exception as e:
            print(f"  Error scraping {movie['title']}: {e}")
            time.sleep(5)

    # Final save
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(enriched_movies, f, ensure_ascii=False, indent=2)
    print("Done!")

if __name__ == "__main__":
    scrape_details()
