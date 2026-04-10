import json
import os
import time
import requests
from bs4 import BeautifulSoup
import urllib.parse

def search_google(query, num_results=5, max_retries=3):
    """Search Google and return results with retry logic."""
    import random
    
    # More realistic browser headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }
    
    query = urllib.parse.quote_plus(query)
    url = f"https://www.google.com/search?q={query}&num={num_results}"
    
    results = []
    
    for attempt in range(max_retries):
        try:
            # Random delay to avoid rate limiting (5-10 seconds)
            if attempt > 0:
                delay = min(30, (2 ** attempt) + random.uniform(3, 7))
                print(f"    Retry {attempt}, waiting {delay:.1f}s...")
                time.sleep(delay)
            
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Try original selector
                for g in soup.find_all('div', class_='g'):
                    anchors = g.find_all('a')
                    if anchors:
                        link = anchors[0]['href']
                        title = g.find('h3')
                        if title:
                            title = title.text
                        else:
                            title = link
                            
                        snippet = g.find('div', class_='VwiC3b')
                        snippet_text = snippet.text if snippet else ""
                        
                        results.append({
                            "title": title,
                            "link": link,
                            "snippet": snippet_text
                        })
                
                # If no results, try alternative selector
                if not results:
                    for item in soup.select('div[data-hveid]'):
                        link_elem = item.find('a', href=True)
                        if link_elem and link_elem['href'].startswith('http'):
                            title_elem = item.find('h3')
                            title = title_elem.text if title_elem else link_elem['href']
                            results.append({
                                "title": title,
                                "link": link_elem['href'],
                                "snippet": ""
                            })
                
                return results  # Success!
                
            elif response.status_code == 429:
                print(f"  Warning: Rate limited (429), attempt {attempt + 1}/{max_retries}")
                continue  # Retry with backoff
            else:
                print(f"  Warning: HTTP {response.status_code}")
                return results  # Don't retry for other errors
                
        except Exception as e:
            print(f"  Search error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                continue
        
    return results

def enrich_person(person):
    """Skip Google enrichment to avoid rate limiting - use only dhliz.com data."""
    name = person.get('name', '')
    
    if not name or name == "Unknown":
        return person
    
    # Skip all Google searches to avoid HTTP 429
    # All enrichment fields remain as empty arrays (already present from scrape_people.py)
    person['bio_search'] = []
    person['news'] = []
    person['awards_search'] = []
    person['social_media'] = []
    
    return person

def enrich_all_people():
    """Enrich all people with Google search data."""
    input_file = "people_details.json"
    output_file = "people_enriched.json"
    
    if not os.path.exists(input_file):
        print(f"{input_file} not found.")
        return
    
    # Load existing progress if available
    if os.path.exists(output_file):
        print(f"Loading existing progress from {output_file}...")
        with open(output_file, 'r', encoding='utf-8') as f:
            people = json.load(f)
        # Find where we left off
        start_index = 0
        for i, person in enumerate(people):
            if 'news' not in person:
                start_index = i
                break
        print(f"Resuming from person {start_index + 1}/{len(people)}")
    else:
        with open(input_file, 'r', encoding='utf-8') as f:
            people = json.load(f)
        start_index = 0
    
    print(f"Enriching {len(people)} people with Google search data...")
    
    for i in range(start_index, len(people)):
        person = people[i]
        name = person.get('name', 'Unknown')
        print(f"[{i+1}/{len(people)}] {name}")
        
        try:
            people[i] = enrich_person(person)
            
            # Save every 10 people
            if (i + 1) % 10 == 0:
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(people, f, ensure_ascii=False, indent=2)
                print(f"  💾 Saved progress...")
            
            # Random delay to avoid detection (5-10 seconds)
            import random
            time.sleep(random.uniform(5, 10))
        except Exception as e:
            print(f"  ⚠️  Error: {e}")
            continue
    
    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(people, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved enriched people to {output_file}")

if __name__ == "__main__":
    enrich_all_people()
    print("\n👥 All people enriched!")
