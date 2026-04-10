import json
import re

INPUT_FILE = "movies_master.json"
OUTPUT_FILE = "movies_master.json"

def get_id_from_url(url):
    if not url: return None
    # Dhliz URL: https://dhliz.com/film/siko_siko/
    # ElCinema URL: https://elcinema.com/work/12345/
    
    if "dhliz.com" in url:
        parts = url.strip('/').split('/')
        return parts[-1]
    elif "elcinema.com" in url:
        parts = url.strip('/').split('/')
        # usually work/ID
        for part in reversed(parts):
            if part.isdigit():
                return part
    return None

def main():
    print(f"Loading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)
        
    print(f"Total Movies: {len(movies)}")
    
    updated_count = 0
    
    for m in movies:
        if not m.get('id'):
            new_id = get_id_from_url(m.get('url'))
            if new_id:
                m['id'] = new_id
                updated_count += 1
            else:
                # Fallback: slugify title
                # But Dhliz usually has URL.
                print(f"Warning: Could not generate ID for {m.get('title')} ({m.get('url')})")
                
    print(f"Assigned IDs to {updated_count} movies.")
    
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    main()
