import json
import os
import requests
from bs4 import BeautifulSoup

def scrape_companies():
    if not os.path.exists("companies_master.json"):
        print("companies_master.json not found. Run extract_entities.py first.")
        return

    with open("companies_master.json", "r", encoding="utf-8") as f:
        companies = json.load(f)
        
    print(f"Found {len(companies)} companies to scrape.")
    
    updated_companies = []
    
    for i, company in enumerate(companies):
        cid = company['id']
        url = f"https://dhliz.com/entity/{cid}/"
        
        try:
            response = requests.get(url)
            if response.status_code == 200:
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # 1. Name
                h1 = soup.find('h1')
                if h1:
                    company['name_ar'] = h1.get_text(strip=True)
                    
                # 2. Info
                # Companies might have a similar panel structure or just a list of movies
                # For now, we just grab the name and maybe some metadata if available
                
                # Check for "عن الشركة" or similar
                # (Assuming similar structure to Person for now, will refine if needed)
                
            updated_companies.append(company)
            
        except Exception as e:
            print(f"Error scraping {cid}: {e}")
            updated_companies.append(company)

    with open("companies_details.json", "w", encoding="utf-8") as f:
        json.dump(updated_companies, f, ensure_ascii=False, indent=2)
    print("Finished scraping companies.")

if __name__ == "__main__":
    scrape_companies()
