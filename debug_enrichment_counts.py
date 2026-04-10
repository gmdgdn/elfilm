import json
import os

MOVIES_FILE = "movies_unified.json"
OUTPUT_FILE = "movies_unified_enriched.json"
print("Checking counts...")

if os.path.exists(MOVIES_FILE):
    with open(MOVIES_FILE, 'r', encoding='utf-8') as f:
        master = json.load(f)
    print(f"Master: {len(master)}")
else:
    print("Master file not found")

if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        enriched = json.load(f)
    print(f"Enriched: {len(enriched)}")
    
    # Check intersection
    enriched_ids = {m.get('id') or m.get('title') for m in enriched}
    
    missing = 0
    for m in master:
        key = m.get('id') or m.get('title')
        if key not in enriched_ids:
            missing += 1
        elif key in enriched_ids:
             # Check if it's "truly" enriched payload
             existing = next((x for x in enriched if (x.get('id') or x.get('title')) == key), {})
             if not (existing.get('news') or existing.get('reviews') or existing.get('watch_links')):
                 missing += 1

    print(f"Calculated missing/needing enrichment: {missing}")

else:
    print("Enriched file not found")
