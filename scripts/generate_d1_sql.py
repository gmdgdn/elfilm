"""
Direct D1 import via wrangler command
Generates INSERT statements and executes them against D1
"""

import json
import glob
import re
from pathlib import Path

def slugify_simple(text: str) -> str:
    """Simple ASCII slug"""
    import unicodedata
    text = unicodedata.normalize('NFKD', text)
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text.lower())
    text = re.sub(r'[-\s]+', '-', text)
    return text.strip('-')

def escape_sql(text):
    """Escape single quotes for SQL"""
    if text is None:
        return 'NULL'
    return "'" + str(text).replace("'", "''") + "'"

def generate_d1_inserts():
    """Generate SQL INSERT statements for D1"""
    
    output = []
    output.append("-- ElFilm D1 Data Import")
    # output.append("BEGIN TRANSACTION;") -- Removed for D1 compatibility
    
    # Import movies
    print("Processing movies...")
    movie_files = glob.glob("movies_*_enriched.json")
    movie_count = 0
    
    for file_path in sorted(movie_files):
        with open(file_path, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        for movie in movies:
            url = movie.get('url', '')
            movie_id = url.split('/')[-2] if url else slugify_simple(movie['title'])
            
            title_clean = re.sub(r'\s*\(\d{4}\)\s*$', '', movie['title'])
            year_match = re.search(r'\((\d{4})\)', movie['title'])
            year = int(year_match.group(1)) if year_match else 0
            
            slug = f"{slugify_simple(title_clean)}_{year}"
            
            duration_match = re.search(r'(\d+)', movie.get('duration_str', ''))
            duration = int(duration_match.group(1)) if duration_match else 'NULL'
            
            output.append(f"""
INSERT OR IGNORE INTO movies (id, slug, title_ar, year, duration_minutes, summary_ar, dhliz_url, rating)
VALUES ({escape_sql(movie_id)}, {escape_sql(slug)}, {escape_sql(title_clean)}, {year}, {duration}, {escape_sql(movie.get('story'))}, {escape_sql(url)}, {movie.get('rating', 0)});
""")
            movie_count += 1
    
    print(f"Generated {movie_count} movie inserts")
    
    # Import people
    print("Processing people...")
    with open('people_enriched.json', 'r', encoding='utf-8') as f:
        people_data = json.load(f)
    
    for person in people_data:
        person_id = person['id']
        name_ar = person.get('name_ar') or person.get('name')
        if not name_ar:
            continue
            
        slug = slugify_simple(name_ar)
        
        output.append(f"""
INSERT OR IGNORE INTO people (id, slug, name_ar, name_en, full_name, birthdate, profile_image, dhliz_url)
VALUES ({escape_sql(person_id)}, {escape_sql(slug)}, {escape_sql(name_ar)}, {escape_sql(person.get('name_en'))}, {escape_sql(person.get('full_name'))}, {escape_sql(person.get('birthdate'))}, {escape_sql(person.get('profile_image'))}, {escape_sql(f'https://dhliz.com/person/{person_id}/')});
""")
    
    print(f"Generated {len(people_data)} people inserts")
    
    # Import companies
    print("Processing companies...")
    with open('companies_enriched.json', 'r', encoding='utf-8') as f:
        companies_data = json.load(f)
    
    for company in companies_data:
        company_id = company['id']
        name_ar = company.get('name')
        slug = slugify_simple(name_ar)
        
        output.append(f"""
INSERT OR IGNORE INTO companies (id, slug, name_ar, kind)
VALUES ({escape_sql(company_id)}, {escape_sql(slug)}, {escape_sql(name_ar)}, 'production');
""")
    
    print(f"Generated {len(companies_data)} company inserts")
    
    # output.append("COMMIT;") -- Removed for D1 compatibility
    
    # Write to file
    with open('d1_import.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(output))
    
    print(f"\n✓ Generated d1_import.sql ({len(output)} lines)")
    print("Run: wrangler d1 execute elfilm_db --file=d1_import.sql")

if __name__ == '__main__':
    generate_d1_inserts()
