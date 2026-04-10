import json
import os

# Check movies
if os.path.exists('movies_exa_enriched_full.json'):
    with open('movies_exa_enriched_full.json', 'r', encoding='utf-8') as f:
        movies = json.load(f)
        print(f"Movies enriched: {len(movies)}")
else:
    print("Movies enrichment file not found")

# Check ElCinema details
if os.path.exists('elcinema_movies_details.json'):
    with open('elcinema_movies_details.json', 'r', encoding='utf-8') as f:
        details = json.load(f)
        print(f"ElCinema details: {len(details)}")
else:
    print("ElCinema details file not found")

# Check people
if os.path.exists('people_exa_enriched.json'):
    with open('people_exa_enriched.json', 'r', encoding='utf-8') as f:
        people = json.load(f)
        print(f"People enriched: {len(people)}")
else:
    print("People enrichment file not found")
