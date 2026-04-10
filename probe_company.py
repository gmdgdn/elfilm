import requests
from bs4 import BeautifulSoup

url = "https://dhliz.com/film/ibn_al_qonsol/"
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# Find cast
for item in soup.find_all('div', class_='person-item'):
    name_a = item.find('a', class_='h3')
    
    if name_a:
        name = name_a.get_text(strip=True)
        href = name_a.get('href', '')
        
        if "أحمد السقا" in name:
            print(f"Name: {name}")
            print(f"Href: {href}")
