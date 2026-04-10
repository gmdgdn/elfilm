import json
import os
import requests
import subprocess
import time
from urllib.parse import urlparse
import shutil

# Configuration
MOVIES_MASTER_FILE = "movies_master.json"
PEOPLE_MASTER_FILE = "people_master.json"
MOVIES_OUTPUT_FILE = "movies_master_r2.json"
PEOPLE_OUTPUT_FILE = "people_master_r2.json"
MOVIES_PROGRESS_FILE = "migration_progress_movies.txt"
PEOPLE_PROGRESS_FILE = "migration_progress_people.txt"
ASSETS_DIR = "assets"
R2_BUCKET = "elfilm-assets"
R2_DOMAIN = "https://assets.elfilm.net"
CHECKPOINT_INTERVAL = 50  # Save progress every 50 items

def load_progress(progress_file):
    """Load the set of already processed IDs from the progress file."""
    if os.path.exists(progress_file):
        with open(progress_file, 'r', encoding='utf-8') as f:
            return set(line.strip() for line in f if line.strip())
    return set()

def save_progress(progress_file, item_id):
    """Append a processed ID to the progress file."""
    with open(progress_file, 'a', encoding='utf-8') as f:
        f.write(f"{item_id}\n")

def download_image(url, temp_path):
    """Downloads an image from a URL to a temporary path."""
    if not url or url.startswith("http://static.dhliz.com/static/img/no-pic"):
        return False
    
    try:
        response = requests.get(url, stream=True, timeout=10)
        if response.status_code == 200:
            with open(temp_path, 'wb') as f:
                response.raw.decode_content = True
                shutil.copyfileobj(response.raw, f)
            return True
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
    return False

def upload_to_r2(local_path, r2_key, content_type="image/jpeg"):
    """Uploads a file to R2 using wrangler CLI."""
    try:
        # Use wrangler r2 object put
        # Command: npx wrangler r2 object put <bucket>/<key> --file=<local_path> --content-type=<content_type>
        cmd = [
            "npx", "wrangler", "r2", "object", "put", 
            f"{R2_BUCKET}/{r2_key}", 
            f"--file={local_path}",
            f"--content-type={content_type}"
        ]
        
        # Run command
        # shell=True is often needed on Windows for npx/npm
        # Force utf-8 encoding to avoid UnicodeDecodeError on Windows
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding='utf-8', errors='replace')
        
        if result.returncode == 0:
            return True
        else:
            print(f"  Error uploading to R2: {result.stderr}")
            return False
    except Exception as e:
        print(f"  Exception during upload: {e}")
        return False

def process_movies(limit=None):
    print("Processing Movies...")
    
    if not os.path.exists(MOVIES_MASTER_FILE):
        print(f"File not found: {MOVIES_MASTER_FILE}")
        return

    # Load progress
    processed_ids = load_progress(MOVIES_PROGRESS_FILE)
    print(f"Resuming: {len(processed_ids)} movies already processed")

    with open(MOVIES_MASTER_FILE, 'r', encoding='utf-8') as f:
        movies = json.load(f)
    
    # Load existing output if it exists (for resume)
    if os.path.exists(MOVIES_OUTPUT_FILE):
        with open(MOVIES_OUTPUT_FILE, 'r', encoding='utf-8') as f:
            updated_movies = json.load(f)
    else:
        updated_movies = []
    
    # Create a mapping for quick updates
    updated_movies_dict = {m.get("id"): m for m in updated_movies if m.get("id")}
    
    count = 0
    checkpoint_count = 0
    
    for movie in movies:
        movie_id = movie.get("id")
        
        # Skip if already processed
        if movie_id and movie_id in processed_ids:
            # Make sure it's in the updated list
            if movie_id not in updated_movies_dict:
                updated_movies_dict[movie_id] = movie.copy()
            continue
        
        if limit and count >= limit:
            if movie_id not in updated_movies_dict:
                updated_movies_dict[movie_id] = movie.copy()
            continue

        # Skip if no ID
        if not movie_id:
            print(f"Skipping movie without ID: {movie.get('title')}")
            # Add to output without processing
            if movie_id not in updated_movies_dict:
                updated_movies_dict[movie_id or f"no_id_{len(updated_movies_dict)}"] = movie.copy()
            continue

        poster_url = movie.get("poster_url")
        
        # Skip if no poster or already on R2
        if not poster_url or "assets.elfilm.net" in poster_url:
            if movie_id not in updated_movies_dict:
                updated_movies_dict[movie_id] = movie.copy()
            save_progress(MOVIES_PROGRESS_FILE, movie_id)
            processed_ids.add(movie_id)
            continue
            
        print(f"Processing Movie: {movie.get('title')} ({movie_id})")
        
        # Determine extension
        ext = "jpg"
        if ".png" in poster_url.lower():
            ext = "png"
        elif ".webp" in poster_url.lower():
            ext = "webp"
            
        local_filename = f"temp_poster_{movie_id}.{ext}"
        r2_key = f"posters/{movie_id}.{ext}"
        
        # Create updated movie copy
        updated_movie = movie.copy()
        
        # Download
        if download_image(poster_url, local_filename):
            # Upload
            if upload_to_r2(local_filename, r2_key, f"image/{ext}"):
                new_url = f"{R2_DOMAIN}/{r2_key}"
                updated_movie["poster_url"] = new_url
                print(f"  Success: {new_url}")
                count += 1
                checkpoint_count += 1
            
            # Cleanup
            if os.path.exists(local_filename):
                os.remove(local_filename)
        
        # Update the dictionary
        updated_movies_dict[movie_id] = updated_movie
        
        # Mark as processed
        save_progress(MOVIES_PROGRESS_FILE, movie_id)
        processed_ids.add(movie_id)
        
        # Save checkpoint
        if checkpoint_count >= CHECKPOINT_INTERVAL:
            print(f"  Checkpoint: Saving progress ({len(updated_movies_dict)} movies)...")
            with open(MOVIES_OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(list(updated_movies_dict.values()), f, ensure_ascii=False, indent=2)
            checkpoint_count = 0
        
    # Final save
    print(f"Saving final movies to {MOVIES_OUTPUT_FILE}")
    with open(MOVIES_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(updated_movies_dict.values()), f, ensure_ascii=False, indent=2)
    print(f"Completed: {count} new movies migrated, {len(processed_ids)} total processed")

def process_people(limit=None):
    print("\nProcessing People...")
    
    if not os.path.exists(PEOPLE_MASTER_FILE):
        print(f"File not found: {PEOPLE_MASTER_FILE}")
        return

    # Load progress
    processed_ids = load_progress(PEOPLE_PROGRESS_FILE)
    print(f"Resuming: {len(processed_ids)} people already processed")

    with open(PEOPLE_MASTER_FILE, 'r', encoding='utf-8') as f:
        people = json.load(f)
    
    # Load existing output if it exists (for resume)
    if os.path.exists(PEOPLE_OUTPUT_FILE):
        with open(PEOPLE_OUTPUT_FILE, 'r', encoding='utf-8') as f:
            updated_people = json.load(f)
    else:
        updated_people = []
    
    # Create a mapping for quick updates
    updated_people_dict = {p.get("id"): p for p in updated_people if p.get("id")}
    
    count = 0
    checkpoint_count = 0
    
    for person in people:
        person_id = person.get("id")
        
        # Skip if already processed
        if person_id and person_id in processed_ids:
            if person_id not in updated_people_dict:
                updated_people_dict[person_id] = person.copy()
            continue
        
        if limit and count >= limit:
            if person_id not in updated_people_dict:
                updated_people_dict[person_id] = person.copy()
            continue

        # Skip if no ID
        if not person_id:
            print(f"Skipping person without ID: {person.get('name')}")
            if person_id not in updated_people_dict:
                updated_people_dict[person_id or f"no_id_{len(updated_people_dict)}"] = person.copy()
            continue

        image_url = person.get("image_url") or person.get("profile_image")
        
        if not image_url or "assets.elfilm.net" in image_url or "no-pic" in image_url:
            if person_id not in updated_people_dict:
                updated_people_dict[person_id] = person.copy()
            save_progress(PEOPLE_PROGRESS_FILE, person_id)
            processed_ids.add(person_id)
            continue
            
        print(f"Processing Person: {person.get('name')} ({person_id})")
        
        ext = "jpg"
        if ".png" in image_url.lower():
            ext = "png"
            
        local_filename = f"temp_person_{person_id}.{ext}"
        r2_key = f"people/{person_id}.{ext}"
        
        updated_person = person.copy()
        
        if download_image(image_url, local_filename):
            if upload_to_r2(local_filename, r2_key, f"image/{ext}"):
                new_url = f"{R2_DOMAIN}/{r2_key}"
                updated_person["profile_image"] = new_url
                # Update image_url as well if it exists
                if "image_url" in updated_person:
                    updated_person["image_url"] = new_url
                print(f"  Success: {new_url}")
                count += 1
                checkpoint_count += 1
                
            if os.path.exists(local_filename):
                os.remove(local_filename)
        
        # Update the dictionary
        updated_people_dict[person_id] = updated_person
        
        # Mark as processed
        save_progress(PEOPLE_PROGRESS_FILE, person_id)
        processed_ids.add(person_id)
        
        # Save checkpoint
        if checkpoint_count >= CHECKPOINT_INTERVAL:
            print(f"  Checkpoint: Saving progress ({len(updated_people_dict)} people)...")
            with open(PEOPLE_OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(list(updated_people_dict.values()), f, ensure_ascii=False, indent=2)
            checkpoint_count = 0

    # Final save
    print(f"Saving final people to {PEOPLE_OUTPUT_FILE}")
    with open(PEOPLE_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(updated_people_dict.values()), f, ensure_ascii=False, indent=2)
    print(f"Completed: {count} new people migrated, {len(processed_ids)} total processed")

if __name__ == "__main__":
    # Run for all items
    print("Starting migration with checkpoint support...")
    print(f"Checkpoints will be saved every {CHECKPOINT_INTERVAL} items")
    print("You can safely interrupt (Ctrl+C) and resume later\n")
    process_movies()
    process_people()
