import json
import os
import requests
import time
from urllib.parse import urlparse

# Configuration
MOVIES_FILE = "movies_unified_enriched.json"
PEOPLE_FILE = "people_details_enriched.json" # Use enriched if available, else people_details.json
ASSETS_DIR = "assets"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path)

def download_image(url, save_path):
    if not url or not url.startswith('http'):
        return False
    
    if os.path.exists(save_path):
        return True # Already downloaded

    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=10)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
    return False

def get_extension(url):
    path = urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    if ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
        return ext
    return '.jpg' # Default

def process_movies():
    print("Processing Movies...")
    ensure_dir(os.path.join(ASSETS_DIR, "movies", "posters"))
    
    with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)
        
    count = 0
    for movie in movies:
        poster_url = movie.get('poster_url')
        if not poster_url:
            continue
            
        movie_id = movie.get('id')
        ext = get_extension(poster_url)
        filename = f"{movie_id}{ext}"
        save_path = os.path.join(ASSETS_DIR, "movies", "posters", filename)
        
        if download_image(poster_url, save_path):
            count += 1
            if count % 50 == 0:
                print(f"Downloaded {count} movie posters...")
                
    print(f"Finished movies. Total downloaded: {count}")

def process_people():
    print("Processing People...")
    ensure_dir(os.path.join(ASSETS_DIR, "people", "profiles"))
    
    # Check which file to use
    input_file = PEOPLE_FILE if os.path.exists(PEOPLE_FILE) else "people_details.json"
    print(f"Reading from {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        people = json.load(f)
        
    count = 0
    for person in people:
        image_url = person.get('image') or person.get('profile_image')
        if not image_url:
            continue
            
        person_id = person.get('id')
        ext = get_extension(image_url)
        filename = f"{person_id}{ext}"
        save_path = os.path.join(ASSETS_DIR, "people", "profiles", filename)
        
        if download_image(image_url, save_path):
            count += 1
            if count % 50 == 0:
                print(f"Downloaded {count} person profiles...")
                
    print(f"Finished people. Total downloaded: {count}")

if __name__ == "__main__":
    process_movies()
    process_people()
