import json
import pandas as pd
import os
import re

# File Paths
MOVIES_JSON_PATH = "movies_unified.json"
PEOPLE_JSON_PATH = "people_enriched.json"
TMDB_MOVIES_CSV = "egyptian_movies.csv"
TMDB_CREDITS_CSV = "egyptian_credits.csv"

# Output Files (Safe Mode)
MOVIES_OUTPUT_PATH = "movies_unified_integrated.json"
PEOPLE_OUTPUT_PATH = "people_enriched_integrated.json"

def load_json(path):
    if not os.path.exists(path):
        return []
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def normalize_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text)).strip().lower()

def main():
    print("Loading data...")
    movies_data = load_json(MOVIES_JSON_PATH)
    people_data = load_json(PEOPLE_JSON_PATH)
    
    try:
        tmdb_movies_df = pd.read_csv(TMDB_MOVIES_CSV)
        tmdb_credits_df = pd.read_csv(TMDB_CREDITS_CSV)
    except FileNotFoundError as e:
        print(f"Error loading CSVs: {e}")
        return

    print(f"Loaded {len(movies_data)} existing movies and {len(people_data)} people.")
    print(f"Loaded {len(tmdb_movies_df)} TMDB movies and {len(tmdb_credits_df)} credits.")

    # 1. Index Existing Data
    print("Indexing existing data...")
    movies_map = {} # (normalized_title, year) -> movie_entry
    for movie in movies_data:
        title = normalize_text(movie.get('title', ''))
        year = str(movie.get('year', '')).strip()
        if title:
            movies_map[(title, year)] = movie

    people_map = {} # normalized_name -> person_entry
    for person in people_data:
        name = normalize_text(person.get('name', ''))
        if name:
            people_map[name] = person

    # 2. Integrate Movies
    print("Integrating movies...")
    new_movies_count = 0
    updated_movies_count = 0
    
    # Map TMDB ID to Internal ID for credit linking
    tmdb_id_to_internal_id = {} 

    for _, row in tmdb_movies_df.iterrows():
        tmdb_id = str(row['ID'])
        title = row['Title']
        original_title = row['Original_Title']
        
        release_date = str(row['Release_Date'])
        year = release_date.split('-')[0] if release_date and release_date != 'nan' else ""
        
        overview = row['Overview'] if pd.notna(row['Overview']) else ""
        poster_url = row['Poster_URL'] if pd.notna(row['Poster_URL']) else ""
        
        norm_title = normalize_text(title)
        
        # Try to match by Title
        key = (norm_title, year)
        movie_entry = movies_map.get(key)
        
        if not movie_entry and original_title:
             # Try matching by Original Title
             norm_orig_title = normalize_text(original_title)
             key_orig = (norm_orig_title, year)
             movie_entry = movies_map.get(key_orig)

        if movie_entry:
            # Update existing
            updated = False
            if not movie_entry.get('poster_url') and poster_url:
                movie_entry['poster_url'] = poster_url
                updated = True
            
            if not movie_entry.get('story') and overview:
                movie_entry['story'] = overview
                updated = True
            
            if 'tmdb_id' not in movie_entry:
                movie_entry['tmdb_id'] = tmdb_id
                updated = True
            
            if 'id' not in movie_entry:
                movie_entry['id'] = f"tmdb_{tmdb_id}"
                updated = True

            if updated:
                updated_movies_count += 1
            
            tmdb_id_to_internal_id[tmdb_id] = movie_entry['id']

        else:
            # Create new
            new_id = f"tmdb_{tmdb_id}"
            new_movie = {
                "title": original_title if original_title else title, # Prefer original title for new entries as it's likely Arabic
                "url": f"https://www.themoviedb.org/movie/{tmdb_id}",
                "id": new_id,
                "year": year,
                "source": "tmdb",
                "poster_url": poster_url,
                "story": overview,
                "genres": [], 
                "cast": [],
                "crew": [],
                "news": [],
                "reviews": [],
                "tmdb_id": tmdb_id
            }
            movies_data.append(new_movie)
            # Add to map to prevent duplicates if CSV has duplicates
            movies_map[(normalize_text(new_movie['title']), year)] = new_movie
            tmdb_id_to_internal_id[tmdb_id] = new_id
            new_movies_count += 1

    print(f"Movies: {new_movies_count} new, {updated_movies_count} updated.")

    # 3. Integrate People & Credits
    print("Integrating credits...")
    new_people_count = 0
    
    # Unique people in TMDB credits
    unique_people = tmdb_credits_df.drop_duplicates(subset=['Person_ID'])
    
    tmdb_person_id_to_internal = {}

    for _, row in unique_people.iterrows():
        tmdb_person_id = str(row['Person_ID'])
        name = row['Name']
        profile_url = row['Profile_Image_URL'] if pd.notna(row['Profile_Image_URL']) else ""
        
        norm_name = normalize_text(name)
        person_entry = people_map.get(norm_name)
        
        if person_entry:
            tmdb_person_id_to_internal[tmdb_person_id] = person_entry['id']
            if not person_entry.get('image_url') and profile_url:
                person_entry['image_url'] = profile_url
        else:
            # Create new person
            new_p_id = f"tmdb_p_{tmdb_person_id}"
            new_person = {
                "id": new_p_id,
                "name": name,
                "type": "Actor/Crew",
                "movies": [],
                "image_url": profile_url,
                "tmdb_id": tmdb_person_id
            }
            people_data.append(new_person)
            people_map[norm_name] = new_person
            tmdb_person_id_to_internal[tmdb_person_id] = new_p_id
            new_people_count += 1

    print(f"People: {new_people_count} new people created.")

    # Link Credits
    print("Linking credits to movies...")
    links_created = 0
    
    # Re-index movies by ID for fast access
    movies_by_id = {m['id']: m for m in movies_data if 'id' in m}
    
    for _, row in tmdb_credits_df.iterrows():
        tmdb_movie_id = str(row['Movie_ID'])
        tmdb_person_id = str(row['Person_ID'])
        role = row['Role'] # Cast or Crew
        job_char = row['Job_Character'] if pd.notna(row['Job_Character']) else ""
        
        internal_movie_id = tmdb_id_to_internal_id.get(tmdb_movie_id)
        internal_person_id = tmdb_person_id_to_internal.get(tmdb_person_id)
        
        if internal_movie_id and internal_person_id:
            movie = movies_by_id[internal_movie_id]
            person_name = row['Name']
            person_image = row['Profile_Image_URL'] if pd.notna(row['Profile_Image_URL']) else ""
            
            credit_entry = {
                "name": person_name,
                "id": internal_person_id,
                "image_url": person_image
            }
            
            if role == "Cast":
                if not any(c.get('id') == internal_person_id for c in movie.get('cast', [])):
                    if job_char:
                        credit_entry['role'] = job_char
                    movie['cast'].append(credit_entry)
                    links_created += 1
            else: # Crew
                if not any(c.get('id') == internal_person_id for c in movie.get('crew', [])):
                    if job_char:
                        credit_entry['role'] = job_char
                    movie['crew'].append(credit_entry)
                    links_created += 1

    print(f"Links: {links_created} credit links created.")

    # Save
    print(f"Saving updated files to {MOVIES_OUTPUT_PATH} and {PEOPLE_OUTPUT_PATH}...")
    save_json(movies_data, MOVIES_OUTPUT_PATH)
    save_json(people_data, PEOPLE_OUTPUT_PATH)
    print("Integration complete.")

if __name__ == "__main__":
    main()
