import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re

def scrape_details_for_file(input_file):
    if not os.path.exists(input_file):
        print(f"Skipping {input_file} (not found)")
        return

    year = input_file.replace("movies_", "").replace(".json", "")
    output_file = f"movies_{year}_details.json"
    
    # Check if output already exists to avoid re-scraping if interrupted
    # Check if output already exists to avoid re-scraping if interrupted
    # if os.path.exists(output_file):
    #     print(f"Details file {output_file} already exists. Skipping.")
    #     return

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            movies = json.load(f)
    except Exception as e:
        print(f"Error reading {input_file}: {e}")
        return

    print(f"Found {len(movies)} movies in {input_file}. Starting details scrape...")
    
    updated_movies = []
    
    for i, movie in enumerate(movies):
        url = movie['url']
        # print(f"[{i+1}/{len(movies)}] Scraping {movie['title']}...")
        
        try:
            response = requests.get(url)
            if response.status_code != 200:
                print(f"Failed to fetch {url}: {response.status_code}")
                updated_movies.append(movie)
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 1. Poster
            poster_img = soup.find('img', class_='poster')
            if poster_img:
                movie['poster_url'] = poster_img.get('src')
            
            # 2. Genres
            genres = []
            for a in soup.find_all('a', href=True):
                if 'section=genres' in a['href']:
                    text = a.get_text(strip=True)
                    if text: 
                        genres.append(text)
            movie['genres'] = list(set([g for g in genres if g.strip()]))
            
            # 3. Story
            story_div = soup.find('span', class_='text-label', string=lambda t: t and 'القصة' in t)
            if story_div:
                parent = story_div.parent
                full_text = parent.get_text(strip=True)
                story_text = full_text.replace('القصة:', '').strip()
                movie['story'] = story_text
            
            # 4. Crew (Rich Structure)
            crew = []
            for item in soup.find_all('div', class_='crew-item'):
                role_div = item.find('div')
                name_a = item.find('a')
                
                if role_div and name_a:
                    role = role_div.get_text(strip=True)
                    name = name_a.get_text(strip=True)
                    href = name_a.get('href', '')
                    
                    # Determine type
                    etype = "unknown"
                    if "/artist/" in href:
                        etype = "person"
                    elif "/entity/" in href:
                        etype = "company"
                    
                    if role and name:
                        crew.append({
                            "role": role,
                            "name": name,
                            "id": href.strip('/').split('/')[-1] if href else "",
                            "type": etype
                        })
            movie['crew'] = crew
            
            # 5. Cast (Rich Structure)
            cast = []
            for item in soup.find_all('div', class_='person-item'):
                name_a = item.find('a', class_='h3')
                img_tag = item.find('img', class_='person-img')
                
                if name_a:
                    name = name_a.get_text(strip=True)
                    href = name_a.get('href', '')
                    
                    # Determine type
                    etype = "unknown"
                    if "/artist/" in href:
                        etype = "person"
                    elif "/entity/" in href:
                        etype = "company"

                    image_url = ""
                    if img_tag:
                        image_url = img_tag.get('data-src') or img_tag.get('src')
                        
                    if name:
                        cast.append({
                            "name": name,
                            "id": href.strip('/').split('/')[-1] if href else "",
                            "type": etype,
                            "image_url": image_url
                        })
            movie['cast'] = cast
            
            # 6. Metadata (Duration, Rating)
            # Duration
            duration_img = soup.find('img', title=re.compile(r'\d+ دقيقة'))
            if duration_img:
                movie['duration_str'] = duration_img.get('title')
            
            # Rating
            rating_input = soup.find('input', id='rating')
            if rating_input:
                try:
                    movie['rating'] = float(rating_input.get('value', 0))
                except ValueError:
                    movie['rating'] = 0
            
            updated_movies.append(movie)
            
            # Be nice to the server
            # time.sleep(0.1) 
            
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            updated_movies.append(movie)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(updated_movies, f, ensure_ascii=False, indent=2)
        
    print(f"Finished {year}. Saved details to {output_file}")

def main():
    start_year = 1920
    end_year = 2025
    
    for year in range(start_year, end_year + 1):
        input_file = f"movies_{year}.json"
        scrape_details_for_file(input_file)

if __name__ == "__main__":
    main()
