"""
ElFilm Data Import Script
Imports enriched JSON data into D1 database

Usage:
  python scripts/import_to_d1.py --db elfilm.db --output seed.sql
"""

import json
import glob
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Set
from unidecode import unidecode
import argparse


def slugify(text: str) -> str:
    """Convert Arabic/English text to URL-safe slug"""
    # Use unidecode to transliterate
    slug = unidecode(text.lower())
    # Remove special characters
    slug = re.sub(r'[^\w\s-]', '', slug)
    # Replace spaces with hyphens
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug.strip('-')


def extract_year_from_title(title: str) -> int:
    """Extract year from title like 'Movie Name (1950)'"""
    match = re.search(r'\((\d{4})\)', title)
    return int(match.group(1)) if match else 0


def parse_duration(duration_str: str) -> int:
    """Parse duration string like '145 دقيقة' to minutes"""
    if not duration_str:
        return None
    match = re.search(r'(\d+)', duration_str)
    return int(match.group(1)) if match else None


def create_database(db_path: str):
    """Create database and run migrations"""
    conn = sqlite3.connect(db_path)
    
    # Read and execute migration
    with open('migrations/001_create_schema.sql', 'r', encoding='utf-8') as f:
        migration = f.read()
        conn.executescript(migration)
    
    conn.commit()
    return conn


def import_movies(conn: sqlite3.Connection) -> Dict[str, str]:
    """Import all enriched movie files. Returns mapping of movie_id -> slug"""
    print("Importing movies...")
    
    movie_files = glob.glob("movies_*_enriched.json")
    movie_files.sort()
    
    movie_slug_map = {}
    total_movies = 0
    
    for file_path in movie_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        for movie in movies:
            # Extract movie ID from URL
            url = movie.get('url', '')
            movie_id = url.split('/')[-2] if url else slugify(movie['title'])
            
            # Create slug
            title_clean = re.sub(r'\s*\(\d{4}\)\s*$', '', movie['title'])
            year = extract_year_from_title(movie['title'])
            slug = f"{slugify(title_clean)}_{year}"
            
            # Handle duplicates
            base_slug = slug
            counter = 1
            while slug in movie_slug_map.values():
                slug = f"{base_slug}_{counter}"
                counter += 1
            
            movie_slug_map[movie_id] = slug
            
            # Extract title parts
            title_ar = title_clean
            title_en = None  # We don't have English titles in current data
            
            # Parse duration
            duration = parse_duration(movie.get('duration_str'))
            
            # Insert movie
            conn.execute("""
                INSERT OR REPLACE INTO movies (
                    id, slug, title_ar, title_en, year, 
                    duration_minutes, summary_ar, dhliz_url, rating
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                movie_id, slug, title_ar, title_en, year,
                duration, movie.get('story'), url, movie.get('rating', 0)
            ))
            
            total_movies += 1
    
    conn.commit()
    print(f"✓ Imported {total_movies} movies")
    return movie_slug_map


def import_people(conn: sqlite3.Connection) -> Dict[str, str]:
    """Import people. Returns mapping of person_id -> slug"""
    print("Importing people...")
    
    with open('people_enriched.json', 'r', encoding='utf-8') as f:
        people_data = json.load(f)
    
    person_slug_map = {}
    
    for person in people_data:
        person_id = person['id']
        
        # Create slug from name
        name_ar = person.get('name_ar') or person.get('name')
        if not name_ar:
            print(f"Warning: Skipping person {person_id} - no name available")
            continue
            
        slug = slugify(name_ar)
        
        # Handle duplicates
        base_slug = slug
        counter = 1
        while slug in person_slug_map.values():
            slug = f"{base_slug}_{counter}"
            counter += 1
        
        person_slug_map[person_id] = slug
        
        # Parse birthdate/deathdate if structured
        birthdate = person.get('birthdate', '')
        
        # Ensure we have name_ar (use name as fallback)
        final_name_ar = person.get('name_ar') or person.get('name') or name_ar
        
        # Insert person
        conn.execute("""
            INSERT OR REPLACE INTO people (
                id, slug, name_ar, name_en, full_name, birthdate, 
                profile_image, dhliz_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            person_id, slug,
            final_name_ar,
            person.get('name_en'),
            person.get('full_name'),
            birthdate,
            person.get('profile_image'),
            f"https://dhliz.com/person/{person_id}/"
        ))
    
    conn.commit()
    print(f"✓ Imported {len(person_slug_map)} people")
    return person_slug_map


def import_companies(conn: sqlite3.Connection) -> Dict[str, str]:
    """Import companies. Returns mapping of company_id -> slug"""
    print("Importing companies...")
    
    with open('companies_enriched.json', 'r', encoding='utf-8') as f:
        companies_data = json.load(f)
    
    company_slug_map = {}
    
    for company in companies_data:
        company_id = company['id']
        
        # Create slug
        name_ar = company.get('name')
        slug = slugify(name_ar)
        
        # Handle duplicates
        base_slug = slug
        counter = 1
        while slug in company_slug_map.values():
            slug = f"{base_slug}_{counter}"
            counter += 1
        
        company_slug_map[company_id] = slug
        
        # Insert company
        conn.execute("""
            INSERT OR REPLACE INTO companies (
                id, slug, name_ar, name_en, kind
            ) VALUES (?, ?, ?, ?, ?)
        """, (
            company_id, slug, name_ar, None, 'production'
        ))
    
    conn.commit()
    print(f"✓ Imported {len(companies_data)} companies")
    return company_slug_map


def import_movie_relations(conn: sqlite3.Connection):
    """Import movie-person and movie-company relations"""
    print("Importing movie relations...")
    
    movie_files = glob.glob("movies_*_enriched.json")
    
    total_cast = 0
    total_crew = 0
    total_companies = 0
    
    for file_path in movie_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        for movie in movies:
            url = movie.get('url', '')
            movie_id = url.split('/')[-2] if url else slugify(movie['title'])
            
            # Import cast
            for idx, cast_member in enumerate(movie.get('cast', [])):
                person_id = cast_member.get('id')
                if not person_id:
                    continue
                
                conn.execute("""
                    INSERT OR IGNORE INTO movie_people (
                        movie_id, person_id, role_kind, billing_order
                    ) VALUES (?, ?, ?, ?)
                """, (movie_id, person_id, 'actor', idx))
                total_cast += 1
            
            # Import crew
            for crew_member in movie.get('crew', []):
                if crew_member.get('type') == 'person':
                    person_id = crew_member.get('id')
                    role = crew_member.get('role', '').lower()
                    
                    # Map Arabic roles to English
                    role_map = {
                        'إخراج': 'director',
                        'قصة': 'writer',
                        'سيناريو': 'writer',
                        'حوار': 'writer',
                        'موسيقى': 'composer',
                        'تصوير': 'cinematography',
                        'مونتاج': 'editor'
                    }
                    
                    role_kind = role_map.get(crew_member.get('role'), 'crew')
                    role_credit = crew_member.get('role')
                    
                    conn.execute("""
                        INSERT OR IGNORE INTO movie_people (
                            movie_id, person_id, role_kind, role_credit
                        ) VALUES (?, ?, ?, ?)
                    """, (movie_id, person_id, role_kind, role_credit))
                    total_crew += 1
                
                elif crew_member.get('type') == 'company':
                    company_id = crew_member.get('id')
                    role = crew_member.get('role', 'إنتاج')
                    
                    role_kind = 'producer' if 'إنتاج' in role else 'production'
                    
                    conn.execute("""
                        INSERT OR IGNORE INTO movie_companies (
                            movie_id, company_id, role_kind
                        ) VALUES (?, ?, ?)
                    """, (movie_id, company_id, role_kind))
                    total_companies += 1
    
    conn.commit()
    print(f"✓ Imported {total_cast} cast relations")
    print(f"✓ Imported {total_crew} crew relations")
    print(f"✓ Imported {total_companies} company relations")


def import_genres(conn: sqlite3.Connection):
    """Extract and import unique genres"""
    print("Extracting genres...")
    
    movie_files = glob.glob("movies_*_enriched.json")
    genre_set: Set[str] = set()
    
    # Collect all unique genres
    for file_path in movie_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        for movie in movies:
            for genre in movie.get('genres', []):
                if genre and genre.strip():
                    genre_set.add(genre.strip())
    
    # Insert genres
    genre_map = {}
    for genre_ar in sorted(genre_set):
        slug = slugify(genre_ar)
        
        cursor = conn.execute("""
            INSERT OR IGNORE INTO genres (slug, name_ar)
            VALUES (?, ?)
            RETURNING id
        """, (slug, genre_ar))
        
        result = cursor.fetchone()
        if result:
            genre_map[genre_ar] = result[0]
        else:
            # Get existing ID
            cursor = conn.execute("SELECT id FROM genres WHERE slug = ?", (slug,))
            genre_map[genre_ar] = cursor.fetchone()[0]
    
    # Link movies to genres
    total_links = 0
    for file_path in movie_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            movies = json.load(f)
        
        for movie in movies:
            url = movie.get('url', '')
            movie_id = url.split('/')[-2] if url else slugify(movie['title'])
            
            for genre in movie.get('genres', []):
                if genre and genre.strip() in genre_map:
                    genre_id = genre_map[genre.strip()]
                    conn.execute("""
                        INSERT OR IGNORE INTO movie_genres (movie_id, genre_id)
                        VALUES (?, ?)
                    """, (movie_id, genre_id))
                    total_links += 1
    
    conn.commit()
    print(f"✓ Imported {len(genre_set)} genres")
    print(f"✓ Created {total_links} genre links")


def main():
    parser = argparse.ArgumentParser(description='Import ElFilm data to D1')
    parser.add_argument('--db', default='elfilm.db', help='SQLite database path')
    parser.add_argument('--output', default='seed.sql', help='Output SQL dump')
    args = parser.parse_args()
    
    print("ElFilm Data Import")
    print("=" * 50)
    
    # Create database
    conn = create_database(args.db)
    
    # Import data
    movie_slugs = import_movies(conn)
    person_slugs = import_people(conn)
    company_slugs = import_companies(conn)
    import_movie_relations(conn)
    import_genres(conn)
    
    # Close connection
    conn.close()
    
    print("\n" + "=" * 50)
    print(f"✓ Import complete! Database: {args.db}")
    print(f"\nTo deploy to D1:")
    print(f"  wrangler d1 execute elfilm_db --file={args.output}")


if __name__ == '__main__':
    main()
