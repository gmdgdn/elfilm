import json
import os

files = [
    'movies_unified.json',
    'movies_exa_enriched_full.json',
    'elcinema_movies_details.json'
]

for f in files:
    if os.path.exists(f):
        try:
            with open(f, 'r', encoding='utf-8') as file:
                data = json.load(file)
                print(f"{f}: {len(data)}")
        except Exception as e:
            print(f"{f}: Error {e}")
    else:
        print(f"{f}: Not found")
