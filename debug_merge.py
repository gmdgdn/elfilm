import json
import re
from difflib import SequenceMatcher

def normalize_title(title):
    if not title: return ""
    title = re.sub(r'[^\w\s]', '', title)
    title = re.sub(r'[أإآ]', 'ا', title)
    title = re.sub(r'ة', 'ه', title)
    return " ".join(title.split())

def check():
    # Load Dhliz 1945
    with open('movies_1945_details.json', 'r', encoding='utf-8') as f:
        dhliz = json.load(f)
    
    # Load ElCinema
    with open('elcinema_movies_details.json', 'r', encoding='utf-8') as f:
        elcinema = json.load(f)
        
    target_title = "سفير جهنم"
    
    d_movie = next((m for m in dhliz if target_title in m['title']), None)
    e_movie = next((m for m in elcinema if target_title in m['title']), None)
    
    if d_movie:
        print(f"Dhliz: {d_movie['title']} ({d_movie['year']})")
        print(f"  Key: {normalize_title(d_movie['title'])}|{d_movie['year']}")
    else:
        print("Dhliz: Not found")
        
    if e_movie:
        print(f"ElCinema: {e_movie['title']} ({e_movie['year']})")
        print(f"  Key: {normalize_title(e_movie['title'])}|{e_movie['year']}")
    else:
        print("ElCinema: Not found")

if __name__ == "__main__":
    check()
