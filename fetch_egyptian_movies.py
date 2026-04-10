import requests
import pandas as pd
import time
import os

# Constants
TMDB_API_KEY = "e17cb4e88b8131c7e2089932deda824f"
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original"

# Output Files
MOVIES_CSV = "egyptian_movies.csv"
CREDITS_CSV = "egyptian_credits.csv"
FAILED_LOG = "failed_requests.log"

def fetch_movies():
    """
    Fetches all Egyptian movies from TMDB discovery endpoint.
    Handles pagination automatically.
    """
    movies = []
    page = 1
    total_pages = 1  # Will be updated after first request
    
    # Check if we can resume
    if os.path.exists(MOVIES_CSV):
        try:
            existing_df = pd.read_csv(MOVIES_CSV)
            if not existing_df.empty:
                print(f"Found existing {MOVIES_CSV} with {len(existing_df)} movies.")
                # We assume if the file exists and is substantial, we might have fetched movies already.
                # However, discovery is page-based. It's safer to re-fetch movies list to be sure we have everything,
                # OR we can just skip this step if the user explicitly wants to resume credits only.
                # For now, let's re-fetch to ensure completeness, but we could optimize.
                # Actually, let's just return the existing dataframe if it seems complete-ish or ask user.
                # But to be safe and simple: let's re-fetch movies list (it's fast) but respect rate limits.
                # Wait, re-fetching 4000 movies takes time. 
                # Let's assume if we have > 0 movies, we skip fetching movies and go to credits?
                # The user asked to "resume".
                return existing_df
        except:
            pass

    print("Starting movie discovery...")
    
    while page <= total_pages:
        url = f"{BASE_URL}/discover/movie"
        params = {
            "api_key": TMDB_API_KEY,
            "with_origin_country": "EG",
            "sort_by": "popularity.desc",
            "page": page
        }
        
        try:
            response = requests.get(url, params=params)
            
            if response.status_code == 429:
                print("Rate limit hit (429). Sleeping for 5 seconds...")
                time.sleep(5)
                continue # Retry same page
                
            response.raise_for_status()
            data = response.json()
            
            total_pages = data['total_pages']
            results = data['results']
            
            for movie in results:
                poster_path = movie.get('poster_path')
                poster_url = f"{IMAGE_BASE_URL}{poster_path}" if poster_path else None
                
                movies.append({
                    "ID": movie['id'],
                    "Title": movie['title'],
                    "Original_Title": movie.get('original_title'),
                    "Release_Date": movie.get('release_date'),
                    "Overview": movie.get('overview'),
                    "Popularity": movie.get('popularity'),
                    "Vote_Average": movie.get('vote_average'),
                    "Poster_URL": poster_url
                })
            
            print(f"Processed page {page}/{total_pages}. Total movies found so far: {len(movies)}")
            page += 1
            time.sleep(0.2) # Rate limiting
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching page {page}: {e}")
            page += 1
            time.sleep(1)

    df = pd.DataFrame(movies)
    df.to_csv(MOVIES_CSV, index=False)
    return df

def fetch_credits(movie_ids):
    """
    Fetches cast and crew for a list of movie IDs.
    """
    credits_data = []
    failed_ids = []
    
    # Check for existing credits to resume
    processed_movie_ids = set()
    if os.path.exists(CREDITS_CSV):
        try:
            existing_credits_df = pd.read_csv(CREDITS_CSV)
            if not existing_credits_df.empty:
                processed_movie_ids = set(existing_credits_df['Movie_ID'].unique())
                print(f"Resuming credits extraction. Found {len(processed_movie_ids)} already processed movies.")
        except:
            pass

    # Filter out already processed movies
    movies_to_process = [mid for mid in movie_ids if mid not in processed_movie_ids]
    
    total_movies = len(movies_to_process)
    if total_movies == 0:
        print("All movies have credits processed!")
        return pd.DataFrame(), []

    print(f"Starting credits extraction for {total_movies} remaining movies...")
    
    # Open CSV in append mode if it exists, else write mode
    mode = 'a' if os.path.exists(CREDITS_CSV) else 'w'
    header = not os.path.exists(CREDITS_CSV)

    for index, movie_id in enumerate(movies_to_process):
        url = f"{BASE_URL}/movie/{movie_id}/credits"
        params = {"api_key": TMDB_API_KEY}
        
        current_movie_credits = []
        
        try:
            response = requests.get(url, params=params)
            
            if response.status_code == 429:
                print(f"Rate limit hit at movie {movie_id}. Sleeping 5s...")
                time.sleep(5)
                try:
                    response = requests.get(url, params=params)
                    response.raise_for_status()
                except:
                    print(f"Retry failed for movie {movie_id}")
                    failed_ids.append(movie_id)
                    continue

            response.raise_for_status()
            data = response.json()
            
            # Process Cast
            for cast_member in data.get('cast', []):
                profile_path = cast_member.get('profile_path')
                profile_url = f"{IMAGE_BASE_URL}{profile_path}" if profile_path else None
                
                current_movie_credits.append({
                    "Movie_ID": movie_id,
                    "Person_ID": cast_member['id'],
                    "Name": cast_member['name'],
                    "Role": "Cast",
                    "Job_Character": cast_member.get('character'),
                    "Profile_Image_URL": profile_url
                })
                
            # Process Crew
            for crew_member in data.get('crew', []):
                profile_path = crew_member.get('profile_path')
                profile_url = f"{IMAGE_BASE_URL}{profile_path}" if profile_path else None
                
                current_movie_credits.append({
                    "Movie_ID": movie_id,
                    "Person_ID": crew_member['id'],
                    "Name": crew_member['name'],
                    "Role": "Crew",
                    "Job_Character": crew_member.get('job'),
                    "Profile_Image_URL": profile_url
                })
                
            # Save batch to CSV immediately to allow resuming
            if current_movie_credits:
                df_batch = pd.DataFrame(current_movie_credits)
                df_batch.to_csv(CREDITS_CSV, mode='a', header=header, index=False)
                header = False # Only write header once
                
        except Exception as e:
            print(f"Failed to fetch credits for movie {movie_id}: {e}")
            failed_ids.append(movie_id)
        
        if (index + 1) % 50 == 0:
            print(f"Processed {index + 1}/{total_movies} movies...")
            
        time.sleep(0.25) 

    return pd.DataFrame(credits_data), failed_ids # Return empty DF as we wrote to file directly

def main():
    # Step 1: Discover Movies
    print("--- Step 1: Discovering Egyptian Movies ---")
    df_movies = fetch_movies()
    
    if df_movies.empty:
        print("No movies found. Exiting.")
        return

    # Step 2: Extract Credits
    print("\n--- Step 2: Extracting Credits ---")
    movie_ids = df_movies['ID'].tolist()
    fetch_credits(movie_ids)
    
    print("\nDone! Script execution complete.")

if __name__ == "__main__":
    main()
