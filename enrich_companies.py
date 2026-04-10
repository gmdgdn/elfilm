"""
Exa enrichment for companies data
"""
import json
import os
from exa_py import Exa
import time

# Load API key
EXA_API_KEY = "3f11c020-cd6d-4676-9857-675788d5f9a6"

exa = Exa(api_key=EXA_API_KEY)

INPUT_FILE = "companies_master.json"
OUTPUT_FILE = "companies_exa_enriched.json"

def enrich_company_with_exa(company):
    """Add info, news, and production data to a company using Exa"""
    name = company.get('name', '')
    
    if not name or name == "None":
        return company
    
    # Search for general info / history
    try:
        info_query = f"معلومات عن شركة {name} للإنتاج السينمائي تاريخها وأهم أعمالها"
        
        print(f"  Searching for info: {info_query}")
        info_results = exa.search_and_contents(
            info_query,
            type="auto",
            num_results=3,
            text={"max_characters": 300}
        )
        
        company['info_search'] = [
            {
                "title": r.title or "",
                "link": r.url or "",
                "snippet": (r.text or "")[:300] if hasattr(r, 'text') else ""
            }
            for r in info_results.results
        ]
    except Exception as e:
        print(f"  Error fetching info for {name}: {e}")
        company['info_search'] = company.get('info_search', [])
    
    # Search for news
    try:
        news_query = f"أخبار شركة {name} للإنتاج الفني"
        
        print(f"  Searching for news: {news_query}")
        news_results = exa.search_and_contents(
            news_query,
            type="auto",
            num_results=3,
            text={"max_characters": 200}
        )
        
        company['news'] = [
            {
                "title": r.title or "",
                "link": r.url or "",
                "snippet": (r.text or "")[:200] if hasattr(r, 'text') else ""
            }
            for r in news_results.results
        ]
    except Exception as e:
        print(f"  Error fetching news for {name}: {e}")
        company['news'] = company.get('news', [])
    
    # Search for official links (website, social media)
    try:
        links_query = f"الموقع الرسمي شركة {name} فيسبوك انستجرام"
        
        print(f"  Searching for links: {links_query}")
        links_results = exa.search_and_contents(
            links_query,
            type="auto",
            num_results=2,
            text={"max_characters": 100}
        )
        
        company['official_links'] = [
            {
                "title": r.title or "",
                "link": r.url or ""
            }
            for r in links_results.results
        ]
    except Exception as e:
        print(f"  Error fetching links for {name}: {e}")
        company['official_links'] = company.get('official_links', [])
    
    time.sleep(1)  # Rate limiting
    return company

if __name__ == "__main__":
    print("Starting Exa enrichment for companies...")
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found.")
        exit(1)

    # Load companies
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        companies = json.load(f)
    
    print(f"Loaded {len(companies)} companies from {INPUT_FILE}")
    
    # Load existing enriched companies to resume
    enriched_companies = []
    enriched_ids = set()
    
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                enriched_companies = json.load(f)
                enriched_ids = {c.get('id', c.get('name')) for c in enriched_companies}
                print(f"Resuming from {len(enriched_companies)} already enriched companies")
        except:
            print("Starting fresh enrichment")
    
    # Enrich companies
    for i, company in enumerate(companies):
        company_id = company.get('id', company.get('name'))
        
        # Skip if already enriched
        if company_id in enriched_ids:
            continue
            
        print(f"\n[{len(enriched_companies)+1}/{len(companies)}] Enriching: {company.get('name', 'Unknown')}")
        
        enriched = enrich_company_with_exa(company)
        enriched_companies.append(enriched)
        enriched_ids.add(company_id)
        
        # Save progress every 10 companies
        if len(enriched_companies) % 10 == 0:
            temp_file = OUTPUT_FILE + ".tmp"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(enriched_companies, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, OUTPUT_FILE)
            print(f"  Saved progress: {len(enriched_companies)} companies")
    
    # Final save
    temp_file = OUTPUT_FILE + ".tmp"
    with open(temp_file, 'w', encoding='utf-8') as f:
        json.dump(enriched_companies, f, ensure_ascii=False, indent=2)
    os.replace(temp_file, OUTPUT_FILE)
    
    print(f"\nDone! Enriched {len(enriched_companies)} companies")
    print(f"Saved to {OUTPUT_FILE}")
