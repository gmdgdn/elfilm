import json
import os
from collections import defaultdict

INPUT_FILE = "movies_master.json"
OUTPUT_FILE = "movies_master.json"
MAPPING_FILE = "id_mapping.json"

def normalize_title(title):
    if not title: return ""
    return title.strip()

def main():
    print("Regenerating Movie IDs...")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        return

    print(f"Loading {INPUT_FILE}...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)
        
    print(f"Total Movies: {len(movies)}")
    
    # Sort movies by Year, then Title
    # Handle missing years by putting them at the end or beginning? 
    # Let's put them at the end (9999) or 0000. 
    # Most have years.
    
    def get_sort_key(m):
        year = m.get('year')
        try:
            y_int = int(year)
        except:
            y_int = 9999
        
        title = normalize_title(m.get('title', ''))
        return (y_int, title)

    movies.sort(key=get_sort_key)
    
    # Assign new IDs
    year_counters = defaultdict(int)
    id_mapping = {}
    updated_movies = []
    
    for m in movies:
        year = m.get('year')
        try:
            y_int = int(year)
        except:
            y_int = 0 # Unknown year
            
        year_counters[y_int] += 1
        count = year_counters[y_int]
        
        # Format: YYYY-XXXX
        # If year is 0, maybe 0000-XXXX
        new_id = f"{y_int:04d}-{count:04d}"
        
        old_id = m.get('id')
        if old_id:
            id_mapping[old_id] = new_id
            
        m['id'] = new_id
        updated_movies.append(m)
        
    print(f"Assigned IDs to {len(updated_movies)} movies.")
    
    # Save mapping
    print(f"Saving mapping to {MAPPING_FILE}...")
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(id_mapping, f, ensure_ascii=False, indent=2)
        
    # Save movies
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(updated_movies, f, ensure_ascii=False, indent=2)
        
    print("Done.")

if __name__ == "__main__":
    main()
