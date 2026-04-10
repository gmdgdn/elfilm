import requests
from bs4 import BeautifulSoup

url = "https://dhliz.com/film/al_abtal_al_thalatha/"
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# Save the formatted HTML to a file so we can inspect it
with open("movie_page_dump.html", "w", encoding="utf-8") as f:
    f.write(soup.prettify())
