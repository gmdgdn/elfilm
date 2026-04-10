import json
import os
import glob

def extract_entities():
    people = {}
    companies = {}
    
    # Find all details files
    files = glob.glob("movies_*_details.json")
    print(f"Found {len(files)} details files.")
    
    for file_path in files:
        print(f"Processing {file_path}...")
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                movies = json.load(f)
                
            for movie in movies:
                # Process Crew
                for member in movie.get('crew', []):
                    eid = member.get('id')
                    etype = member.get('type', 'unknown')
                    name = member.get('name')
                    
                    if not eid:
                        continue
                        
                    if etype == 'person':
                        if eid not in people:
                            people[eid] = {"id": eid, "name": name, "type": "person", "movies": []}
                        people[eid]["movies"].append(movie.get('title'))
                    elif etype == 'company':
                        if eid not in companies:
                            companies[eid] = {"id": eid, "name": name, "type": "company", "movies": []}
                        companies[eid]["movies"].append(movie.get('title'))
                    else:
                        # Fallback logic if type is missing (e.g. old scrape)
                        # Heuristic: Companies usually have specific roles, but let's rely on type first
                        pass

                # Process Cast (Always people)
                for member in movie.get('cast', []):
                    eid = member.get('id')
                    name = member.get('name')
                    image_url = member.get('image_url')
                    
                    if not eid:
                        continue
                        
                    if eid not in people:
                        people[eid] = {"id": eid, "name": name, "type": "person", "image_url": image_url, "movies": []}
                    else:
                        # Update image if missing
                        if not people[eid].get('image_url') and image_url:
                            people[eid]['image_url'] = image_url
                            
                    people[eid]["movies"].append(movie.get('title'))
                    
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # Deduplicate movie lists
    for p in people.values():
        p['movies'] = list(set(p['movies']))
    for c in companies.values():
        c['movies'] = list(set(c['movies']))
        
    # Save Master Lists
    with open("people_master.json", "w", encoding="utf-8") as f:
        json.dump(list(people.values()), f, ensure_ascii=False, indent=2)
        
    with open("companies_master.json", "w", encoding="utf-8") as f:
        json.dump(list(companies.values()), f, ensure_ascii=False, indent=2)
        
    print(f"Extracted {len(people)} unique people and {len(companies)} unique companies.")

if __name__ == "__main__":
    extract_entities()
