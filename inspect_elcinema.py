import requests
from bs4 import BeautifulSoup

url = "https://elcinema.com/index/work/country/eg?page=1"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.content, 'html.parser')

rows = soup.find_all('tr')
print(f"Found {len(rows)} rows")
for i, row in enumerate(rows[:3]):
    print(f"Row {i}:")
    cols = row.find_all('td')
    print(f"  Cols: {len(cols)}")
    if len(cols) >= 2:
        print("  Col 1 (Title/Image):")
        links = cols[1].find_all('a')
        for l in links:
            print(f"    Link: '{l.get_text()}' href={l.get('href')}")

