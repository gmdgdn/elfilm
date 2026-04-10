import json
import os
import time
from exa_enrichment_template import enrich_movie_with_exa as enrich_movie

MOVIES_FILE = "movies_unified.json"
OUTPUT_FILE = "movies_unified_enriched.json"

def load_json(filename):
    if not os.path.exists(filename):
        return []
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, filename):
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def main():
    print(f"Loading master movies from {MOVIES_FILE}...")
    master_movies = load_json(MOVIES_FILE)
    print(f"Loaded {len(master_movies)} master movies.")

    print(f"Loading existing enriched movies from {OUTPUT_FILE}...")
    enriched_movies = load_json(OUTPUT_FILE)
    print(f"Loaded {len(enriched_movies)} enriched movies.")

    # Create a lookup for enriched movies by ID or title+year
    # Assuming 'id' is the unique key, falling back to title if needed
    enriched_map = {}
    for m in enriched_movies:
        # Use ID if available, otherwise title
        key = m.get('id') or m.get('title')
        if key:
            enriched_map[key] = m

    # Merge process
    final_movies = []
    to_enrich_indices = []

    print("Merging datasets...")
    for i, m in enumerate(master_movies):
        key = m.get('id') or m.get('title')
        
        if key in enriched_map:
            # Use the already enriched version
            existing = enriched_map[key]
            # Verify it's actually enriched (has news or reviews)
            if existing.get('news') or existing.get('reviews') or existing.get('watch_links'):
                 final_movies.append(existing)
            else:
                # Exists but not enriched? Add to enrich queue
                final_movies.append(m)
                to_enrich_indices.append(len(final_movies) - 1)
        else:
            # New movie, add to enrich queue
            final_movies.append(m)
            to_enrich_indices.append(len(final_movies) - 1)

    print(f"Total movies after merge: {len(final_movies)}")
    print(f"Movies needing enrichment: {len(to_enrich_indices)}")
    
    if not to_enrich_indices:
        print("Nothing to enrich! Exiting.")
        return

    enriched_count = 0
    failed_count = 0
    
    for idx in to_enrich_indices:
        movie = final_movies[idx]
        try:
            print(f"Enriching [{enriched_count + 1}/{len(to_enrich_indices)}]: {movie.get('title').encode('utf-8', 'replace').decode('utf-8')} ({movie.get('year')})")
        except:
             print(f"Enriching [{enriched_count + 1}/{len(to_enrich_indices)}]: [Title Error] ({movie.get('year')})")
        
        try:
            # Pass a copy so we don't modify the original if it fails
            enriched_movie = enrich_movie(movie.copy())
            
            # Update the movie in the main list
            final_movies[idx] = enriched_movie
            enriched_count += 1
            
            # Save every 5 movies to prevent data loss
            if enriched_count % 5 == 0:
                save_json(final_movies, OUTPUT_FILE)
                print(f"Saved progress to {OUTPUT_FILE}")
                
        except Exception as e:
            try:
                print(f"Failed to enrich {movie.get('title', 'Unknown').encode('utf-8', 'replace').decode('utf-8')}: {str(e).encode('utf-8', 'replace').decode('utf-8')}")
            except:
                print("Failed to enrich movie (and failed to print error)")
            failed_count += 1
            
        # Small delay to be nice to APIs
        # time.sleep(0.5)

    # Final save
    save_json(final_movies, OUTPUT_FILE)
    print("Enrichment complete.")
    print(f"Enriched: {enriched_count}")
    print(f"Failed: {failed_count}")

if __name__ == "__main__":
    main()
