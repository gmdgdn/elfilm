import requests
from bs4 import BeautifulSoup

url = "https://dhliz.com/film/al_embratour/"
response = requests.get(url)
soup = BeautifulSoup(response.content, 'html.parser')

# Save the formatted HTML to a file
with open("movie_page_dump_rich.html", "w", encoding="utf-8") as f:
    f.write(soup.prettify())
