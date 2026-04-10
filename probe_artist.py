import requests
from bs4 import BeautifulSoup

url = "https://dhliz.com/artist/ahmad_al_saqa/"
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# 1. Name
name = soup.find('h1')
print(f"Name: {name.get_text(strip=True) if name else 'Not found'}")

# 2. Bio
bio = soup.find('div', class_='text-justify')
print(f"Bio: {bio.get_text(strip=True)[:100] if bio else 'Not found'}...")

# 3. Birthdate
# Usually in a table or list
info_table = soup.find('table', class_='table')
if info_table:
    for row in info_table.find_all('tr'):
        cols = row.find_all('td')
        if len(cols) >= 2:
            key = cols[0].get_text(strip=True)
            val = cols[1].get_text(strip=True)
            print(f"{key}: {val}")

# 4. Images
images = []
gallery = soup.find('div', id='gallery')
if gallery:
    for img in gallery.find_all('img'):
        src = img.get('data-src') or img.get('src')
        images.append(src)
print(f"Found {len(images)} gallery images.")
