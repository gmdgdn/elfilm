import requests
from bs4 import BeautifulSoup
import json
import time
import os

def scrape_movies_for_year(year):
    url = f"https://dhliz.com/search?query={year}&section=years"
    print(f"Fetching movies for {year}...")
    try:
        response = requests.get(url)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Error fetching URL for {year}: {e}")
        return []

    soup = BeautifulSoup(response.content, 'html.parser')
    
    movies = []
    
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        text = a_tag.get_text(strip=True)
        
        if '/film/' in href and text:
            if text == "(المزيد)":
                continue
                
            if not href.startswith('http'):
                full_url = f"https://dhliz.com{href}"
            else:
                full_url = href
            
            movies.append({
                "title": text,
                "url": full_url
            })

    # Remove duplicates
    unique_movies = {m['url']: m for m in movies}.values()
    return list(unique_movies)

def main():
    start_year = 1920
    end_year = 2025
    
    for year in range(start_year, end_year + 1):
        movies = scrape_movies_for_year(year)
        
        if movies:
            output_file = f"movies_{year}.json"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(movies, f, ensure_ascii=False, indent=2)
            print(f"Scraped {len(movies)} movies for {year}. Saved to {output_file}")
        else:
            print(f"No movies found for {year}")
            
        # Be nice to the server
        time.sleep(1)

if __name__ == "__main__":
    main()
