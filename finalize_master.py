import json
import os
import shutil

INPUT_FILE = "movies_unified_enriched.json"
OUTPUT_FILE = "movies_master.json"
PEOPLE_INPUT = "people_exa_enriched.json"
PEOPLE_OUTPUT = "people_master.json"

def main():
    print("Finalizing Master Datasets...")
    
    # 1. Movies
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found. Did enrichment finish?")
        # Fallback to movies_unified.json if enriched doesn't exist?
        if os.path.exists("movies_unified.json"):
            print("Falling back to movies_unified.json")
            INPUT_FILE_USED = "movies_unified.json"
        else:
            return
    else:
        INPUT_FILE_USED = INPUT_FILE

    print(f"Loading {INPUT_FILE_USED}...")
    with open(INPUT_FILE_USED, 'r', encoding='utf-8') as f:
        movies = json.load(f)
        
    print(f"Total Movies: {len(movies)}")
    
    # Calculate stats
    enriched_count = sum(1 for m in movies if m.get('news') or m.get('reviews'))
    elcinema_count = sum(1 for m in movies if m.get('source') == 'elcinema' or 'elcinema' in m.get('_sources', []))
    
    print(f"Enriched with Exa: {enriched_count} ({enriched_count/len(movies)*100:.1f}%)")
    
    # Save to master
    print(f"Saving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
        
    # 2. People
    print(f"Processing People...")
    if os.path.exists(PEOPLE_INPUT):
        shutil.copy(PEOPLE_INPUT, PEOPLE_OUTPUT)
        print(f"Copied {PEOPLE_INPUT} to {PEOPLE_OUTPUT}")
    else:
        print(f"Warning: {PEOPLE_INPUT} not found.")
        
    print("Done.")

if __name__ == "__main__":
    main()
