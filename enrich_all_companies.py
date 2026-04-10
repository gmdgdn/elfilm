import json
import os
import time
import requests
from bs4 import BeautifulSoup
import urllib.parse

def search_google(query, num_results=5):
    """Search Google and return results."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    query = urllib.parse.quote_plus(query)
    url = f"https://www.google.com/search?q={query}&num={num_results}"
    
    results = []
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
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
        else:
            print(f"  Warning: HTTP {response.status_code}")
    except Exception as e:
        print(f"  Search error: {e}")
        
    return results

def enrich_company(company):
    """Enrich a company with Google search data."""
    name = company.get('name', '')
    
    if not name or name == "Unknown":
        return company
    
    # 1. Company Info/History
    info_query = f"{name} شركة إنتاج مصرية"
    info_results = search_google(info_query, num_results=5)
    company['info_search'] = info_results
    
    # 2. News
    news_query = f"أخبار {name}"
    news_results = search_google(news_query, num_results=5)
    company['news'] = news_results
    
    # 3. Productions/Filmography
    productions_query = f"أفلام {name}"
    productions_results = search_google(productions_query, num_results=3)
    company['productions_search'] = productions_results
    
    # 4. Website/Official Links
    website_query = f"{name} موقع رسمي"
    website_results = search_google(website_query, num_results=3)
    
    # Extract potential official links
    official_links = []
    for res in website_results:
        link = res['link']
        # Filter for potentially official domains
        if not any(x in link for x in ['facebook', 'twitter', 'youtube', 'instagram', 'wikipedia']):
            official_links.append({
                "url": link,
                "title": res['title']
            })
    
    company['official_links'] = official_links
    
    return company

def enrich_all_companies():
    """Enrich all companies with Google search data."""
    input_file = "companies_details.json"
    output_file = "companies_enriched.json"
    
    if not os.path.exists(input_file):
        print(f"{input_file} not found.")
        return
    
    # Load existing progress if available
    if os.path.exists(output_file):
        print(f"Loading existing progress from {output_file}...")
        with open(output_file, 'r', encoding='utf-8') as f:
            companies = json.load(f)
        # Find where we left off
        start_index = 0
        for i, company in enumerate(companies):
            if 'news' not in company:
                start_index = i
                break
        print(f"Resuming from company {start_index + 1}/{len(companies)}")
    else:
        with open(input_file, 'r', encoding='utf-8') as f:
            companies = json.load(f)
        start_index = 0
    
    print(f"Enriching {len(companies)} companies with Google search data...")
    
    for i in range(start_index, len(companies)):
        company = companies[i]
        name = company.get('name', 'Unknown')
        print(f"[{i+1}/{len(companies)}] {name}")
        
        try:
            companies[i] = enrich_company(company)
            
            # Save every 5 companies (there are fewer companies)
            if (i + 1) % 5 == 0:
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(companies, f, ensure_ascii=False, indent=2)
                print(f"  💾 Saved progress...")
            
            # Be respectful to Google
            time.sleep(3)
        except Exception as e:
            print(f"  ⚠️  Error: {e}")
            continue
    
    # Final save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(companies, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved enriched companies to {output_file}")

if __name__ == "__main__":
    enrich_all_companies()
    print("\n🏢 All companies enriched!")
