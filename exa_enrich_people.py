"""
Exa enrichment for people data
"""
import json
import os
from exa_py import Exa
import time

# Load API key
EXA_API_KEY = "3f11c020-cd6d-4676-9857-675788d5f9a6"

exa = Exa(api_key=EXA_API_KEY)

INPUT_FILE = "people_enriched.json"
OUTPUT_FILE = "people_exa_enriched.json"

def enrich_person_with_exa(person):
    """Add biographical data and news to a person using Exa"""
    name = person.get('name', '')
    
    if not name or name == "Unknown":
        return person
    
    # Search for biographical information
    try:
        bio_query = f"{name} ممثل مصري السيرة الذاتية"
        
        print(f"  Searching for bio: {bio_query}")
        bio_results = exa.search_and_contents(
            bio_query,
            type="auto",
            num_results=3,
            text={"max_characters": 200}
        )
        
        person['bio_search'] = [
            {
                "title": r.title or "",
                "link": r.url or "",
                "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
            }
            for r in bio_results.results
        ]
    except Exception as e:
        print(f"  Error fetching bio for {name}: {e}")
        person['bio_search'] = person.get('bio_search', [])
    
    # Search for news
    try:
        news_query = f"أخبار {name}"
        
        print(f"  Searching for news: {news_query}")
        news_results = exa.search_and_contents(
            news_query,
            type="auto",
            num_results=3,
            text={"max_characters": 200}
        )
        
        person['news'] = [
            {
                "title": r.title or "",
                "link": r.url or "",
                "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
            }
            for r in news_results.results
        ]
    except Exception as e:
        print(f"  Error fetching news for {name}: {e}")
        person['news'] = person.get('news', [])
    
    # Search for awards
    try:
        awards_query = f"جوائز {name}"
        
        print(f"  Searching for awards: {awards_query}")
        awards_results = exa.search_and_contents(
            awards_query,
            type="auto",
            num_results=2,
            text={"max_characters": 200}
        )
        
        person['awards_search'] = [
            {
                "title": r.title or "",
                "link": r.url or "",
                "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
            }
            for r in awards_results.results
        ]
    except Exception as e:
        print(f"  Error fetching awards for {name}: {e}")
        person['awards_search'] = person.get('awards_search', [])
    
    time.sleep(1)  # Rate limiting
    return person

if __name__ == "__main__":
    print("Starting Exa enrichment for people...")
    
    # Load people
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        people = json.load(f)
    
    print(f"Loaded {len(people)} people from {INPUT_FILE}")
    
    # Load existing enriched people to resume
    enriched_people = []
    enriched_ids = set()
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_people = json.load(f)
                enriched_ids = {p.get('id', p.get('name')) for p in enriched_people}
                print(f"Resuming from {len(enriched_people)} already enriched people")
        except:
            print("Starting fresh enrichment")
    
    # Enrich people
    for i, person in enumerate(people):
        person_id = person.get('id', person.get('name'))
        
        # Skip if already enriched
        if person_id in enriched_ids:
            continue
            
        print(f"\n[{len(enriched_people)+1}/{len(people)}] Enriching: {person.get('name', 'Unknown')}")
        
        enriched = enrich_person_with_exa(person)
        enriched_people.append(enriched)
        enriched_ids.add(person_id)
        
        # Save progress every 10 people
        if len(enriched_people) % 10 == 0:
            temp_file = OUTPUT_FILE + ".tmp"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(enriched_people, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, OUTPUT_FILE)
            print(f"  Saved progress: {len(enriched_people)} people")
    
    # Final save
    temp_file = OUTPUT_FILE + ".tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_people, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, OUTPUT_FILE)
    
    print(f"\nDone! Enriched {len(enriched_people)} people")
    print(f"Saved to {OUTPUT_FILE}")
