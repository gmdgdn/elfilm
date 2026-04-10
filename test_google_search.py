"""
Test script to diagnose Google search issues
"""
import requests
from bs4 import BeautifulSoup
import urllib.parse

def test_search_google(query):
    """Test the current search_google implementation"""
    print(f"\n{'='*60}")
    print(f"Testing query: {query}")
    print(f"{'='*60}\n")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    query_encoded = urllib.parse.quote_plus(query)
    url = f"https://www.google.com/search?q={query_encoded}&num=5"
    
    print(f"URL: {url}\n")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Length: {len(response.content)} bytes\n")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Try to find results with the original selector
            results_original = soup.find_all('div', class_='g')
            print(f"Results found with original selector (class='g'): {len(results_original)}")
            
            # Try alternative selectors
            results_alt1 = soup.find_all('div', {'data-hveid': True})
            print(f"Results found with alternative selector (data-hveid): {len(results_alt1)}")
            
            # Print the first 2000 chars of HTML to inspect structure
            print(f"\nFirst 2000 characters of HTML response:")
            print("-" * 60)
            print(response.text[:2000])
            print("-" * 60)
            
            # Try to extract any links
            all_links = soup.find_all('a')
            print(f"\nTotal links found: {len(all_links)}")
            
            # Show the first few meaningful links
            meaningful_links = []
            for link in all_links:
                href = link.get('href', '')
                if href.startswith('http') and 'google' not in href:
                    meaningful_links.append(href)
                if len(meaningful_links) >= 5:
                    break
            
            if meaningful_links:
                print("\nSample external links found:")
                for link in meaningful_links:
                    print(f"  - {link}")
            else:
                print("\nNo external links found (Google may be blocking)")
                
        else:
            print(f"Request failed with status code: {response.status_code}")
            print(f"Response headers: {response.headers}")
            
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")

if __name__ == "__main__":
    # Test with Egyptian movie searches
    test_queries = [
        "مشاهدة فيلم السرب كامل",
        "أخبار فيلم السرب",
        "عادل إمام ممثل مصري"
    ]
    
    for query in test_queries:
        test_search_google(query)
