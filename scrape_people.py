import json
import os
import requests
from bs4 import BeautifulSoup
import time
import random

def scrape_people():
    if not os.path.exists("people_master.json"):
        print("people_master.json not found. Run extract_entities.py first.")
        return

    with open("people_master.json", "r", encoding="utf-8") as f:
        people = json.load(f)
        
    print(f"Found {len(people)} people to scrape.")
    
    updated_people = []
    # Check if we have a progress file
    if os.path.exists("people_details.json"):
        with open("people_details.json", "r", encoding="utf-8") as f:
            updated_people = json.load(f)
        print(f"Resuming... already scraped {len(updated_people)} people.")
        scraped_ids = set(p['id'] for p in updated_people)
    else:
        scraped_ids = set()

    for i, person in enumerate(people):
        pid = person['id']
        if pid in scraped_ids:
            continue
            
        url = f"https://dhliz.com/artist/{pid}/"
        # print(f"[{i+1}/{len(people)}] Scraping {person['name']} ({pid})...")
        
        try:
            response = requests.get(url)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # 1. Names
                h1_ar = soup.find('h1')
                if h1_ar:
                    person['name_ar'] = h1_ar.get_text(strip=True)
                    
                # Try to find English name (often in a div dir="ltr" below)
                div_ltr = soup.find('div', dir='ltr')
                if div_ltr:
                    h1_en = div_ltr.find('h1')
                    if h1_en:
                        person['name_en'] = h1_en.get_text(strip=True)

                # 2. Bio & Metadata
                # Find panel "عن الفنان"
                about_panel = None
                for panel in soup.find_all('div', class_='panel'):
                    heading = panel.find('div', class_='panel-heading')
                    if heading and "عن الفنان" in heading.get_text():
                        about_panel = panel
                        break
                
                if about_panel:
                    body = about_panel.find('div', class_='panel-body')
                    if body:
                        # Parse key-value pairs
                        # Structure: col-xs-4 (label) -> col-xs-8 (value)
                        labels = body.find_all('div', class_='col-xs-4')
                        for label_div in labels:
                            key = label_div.get_text(strip=True).replace(':', '')
                            
                            # Value is the next sibling div with col-xs-8
                            value_div = label_div.find_next_sibling('div', class_='col-xs-8')
                            if value_div:
                                val = value_div.get_text(strip=True)
                                
                                if "الميلاد" in key:
                                    person['birthdate'] = val
                                elif "الاسم الأصلي" in key:
                                    person['full_name'] = val
                                elif "سنوات العمل" in key:
                                    person['years_active'] = val
                                elif "الزيجات" in key:
                                    person['spouses'] = val
                                elif "الأبناء" in key:
                                    person['children'] = val

                # 3. Images
                images = []
                # Profile poster
                poster = soup.find('img', class_='poster')
                if poster:
                    src = poster.get('src')
                    if src:
                        images.append(src)
                        person['profile_image'] = src
                
                # Gallery items
                for gitem in soup.find_all('div', class_='gallery-item'):
                    img = gitem.find('img')
                    if img:
                        src = img.get('data-src') or img.get('src')
                        if src:
                            images.append(src)
                            
                person['images'] = list(set(images))
                
            else:
                print(f"Failed to fetch {url}: {response.status_code}")
                
            updated_people.append(person)
            
            # Save periodically
            if len(updated_people) % 10 == 0:
                with open("people_details.json", "w", encoding="utf-8") as f:
                    json.dump(updated_people, f, ensure_ascii=False, indent=2)
                    
            # time.sleep(0.1)
            
        except Exception as e:
            print(f"Error scraping {pid}: {e}")
            updated_people.append(person)

    # Final save
    with open("people_details.json", "w", encoding="utf-8") as f:
        json.dump(updated_people, f, ensure_ascii=False, indent=2)
    print("Finished scraping people.")

if __name__ == "__main__":
    scrape_people()
