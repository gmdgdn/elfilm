import json

UNIFIED_FILE = "movies_unified.json"
ENRICHED_FILE = "movies_exa_enriched_full.json"
OUTPUT_FILE = "movies_unified_with_legacy_enrichment.json"

def normalize_title(title):
    import re
    if not title: return ""
    title = re.sub(r'[^\w\s]', '', title)
    title = re.sub(r'[أإآ]', 'ا', title)
    title = re.sub(r'ة', 'ه', title)
    return " ".join(title.split())

def main():
    print("Loading datasets...")
    with open(UNIFIED_FILE, 'r', encoding='utf-8') as f:
        unified = json.load(f)
        
    try:
        with open(ENRICHED_FILE, 'r', encoding='utf-8') as f:
            enriched = json.load(f)
    except FileNotFoundError:
        print(f"Warning: {ENRICHED_FILE} not found. Skipping merge.")
        return

    print(f"Unified: {len(unified)}")
    print(f"Enriched (Legacy): {len(enriched)}")
    
    # Index enriched movies by ID or Title|Year
    enriched_map = {}
    for m in enriched:
        # Prefer ID if available (Dhliz ID?)
        # Or normalize title
        title = m.get('title', '')
        year = str(m.get('year', ''))
        
        # Clean title of year if present (just in case)
        import re
        year_match = re.search(r'\((\d{4})\)', title)
        if year_match:
             title = title.replace(f"({year_match.group(1)})", "").strip()
             
        key = f"{normalize_title(title)}|{year}"
        enriched_map[key] = m
        
        # Also map by url if available
        if m.get('url'):
            enriched_map[m['url']] = m

    merged_count = 0
    
    for m in unified:
        # Try to find match
        match = None
        
        if m.get('url') and m['url'] in enriched_map:
            match = enriched_map[m['url']]
        else:
            title = m.get('title', '')
            year = str(m.get('year', ''))
            key = f"{normalize_title(title)}|{year}"
            match = enriched_map.get(key)
            
        if match:
            # Copy enrichment fields
            if match.get('news'):
                m['news'] = match['news']
            if match.get('reviews'):
                m['reviews'] = match['reviews']
            merged_count += 1
            
    print(f"Merged enrichment into {merged_count} movies.")
    
    # Save back to movies_unified.json (or a new file first)
    with open(UNIFIED_FILE, 'w', encoding='utf-8') as f:
        json.dump(unified, f, ensure_ascii=False, indent=2)
    print(f"Saved to {UNIFIED_FILE}")

if __name__ == "__main__":
    main()
