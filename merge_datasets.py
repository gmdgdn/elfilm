"""
Merge Dhliz and ElCinema datasets
Combines data from both sources into a unified master list.
"""
import json
import os
import re
from difflib import SequenceMatcher

DHLIZ_DIR = "." # Current dir has movies_YYYY_details.json
ELCINEMA_FILE = "elcinema_movies_details.json"
OUTPUT_FILE = "movies_unified.json"

def normalize_title(title):
    """Normalize title for comparison"""
    if not title: return ""
    # Remove punctuation
    title = re.sub(r'[^\w\s]', '', title)
    # Normalize alef
    title = re.sub(r'[أإآ]', 'ا', title)
    # Normalize teh marbuta
    title = re.sub(r'ة', 'ه', title)
    # Remove extra spaces
    return " ".join(title.split())

def similar(a, b):
    """Check similarity between two strings"""
    return SequenceMatcher(None, a, b).ratio()

def load_dhliz_movies():
    movies = []
    for filename in os.listdir(DHLIZ_DIR):
        if filename.startswith("movies_") and filename.endswith("_details.json"):
            try:
                with open(os.path.join(DHLIZ_DIR, filename), 'r', encoding='utf-8') as f:
                    year_movies = json.load(f)
                    movies.extend(year_movies)
            except:
                pass
    return movies

def merge_data():
    print("Loading datasets...")
    dhliz_movies = load_dhliz_movies()
    print(f"Loaded {len(dhliz_movies)} Dhliz movies.")
    
    elcinema_movies = []
    if os.path.exists(ELCINEMA_FILE):
        with open(ELCINEMA_FILE, 'r', encoding='utf-8') as f:
            elcinema_movies = json.load(f)
    print(f"Loaded {len(elcinema_movies)} ElCinema movies.")
    
    unified_movies = []
    matched_count = 0
    new_count = 0
    
    # Index Dhliz movies by normalized title + year
    dhliz_index = {}
    for m in dhliz_movies:
        title = m.get('title', '')
        year = str(m.get('year', ''))
        
        # Extract year from title if missing
        if not year or year == '':
            year_match = re.search(r'\((\d{4})\)', title)
            if year_match:
                year = year_match.group(1)
                # Clean title
                title = title.replace(f"({year})", "").strip()
                # Update movie object for future use
                m['year'] = year
                m['title'] = title
        
        norm_title = normalize_title(title)
        key = f"{norm_title}|{year}"
        dhliz_index[key] = m

    
    # Process ElCinema movies
    for em in elcinema_movies:
        norm_title = normalize_title(em.get('title', ''))
        year = str(em.get('year', ''))
        
        # Try exact match
        key = f"{norm_title}|{year}"
        match = dhliz_index.get(key)
        
        # Try +/- 1 year match
        if not match:
            try:
                y_int = int(year)
                match = dhliz_index.get(f"{norm_title}|{y_int-1}") or dhliz_index.get(f"{norm_title}|{y_int+1}")
            except:
                pass
                
        if match:
            # Enrich existing Dhliz movie
            matched_count += 1
            
            # Merge fields
            if not match.get('poster_url') and em.get('poster_url'):
                match['poster_url'] = em['poster_url']
            
            if not match.get('story') and em.get('story'):
                match['story'] = em['story']
                
            if not match.get('genres') and em.get('genres'):
                match['genres'] = em['genres']
                
            # Merge cast/crew? Dhliz might be better, but ElCinema has images.
            # Let's keep Dhliz as primary but add ElCinema ID
            match['elcinema_id'] = em['id']
            match['elcinema_url'] = em['url']
            
            # Add to unified list (replacing the original dhliz entry in our processing list)
            # We need to track which dhliz movies are processed.
            match['_processed'] = True
            unified_movies.append(match)
            
        else:
            # New movie from ElCinema
            new_count += 1
            em['source'] = 'elcinema'
            unified_movies.append(em)
            
    # Add remaining Dhliz movies
    for m in dhliz_movies:
        if not m.get('_processed'):
            unified_movies.append(m)
            
    print(f"Merge complete.")
    print(f"  Matched: {matched_count}")
    print(f"  New from ElCinema: {new_count}")
    print(f"  Total Unified: {len(unified_movies)}")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(unified_movies, f, ensure_ascii=False, indent=2)
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    merge_data()
