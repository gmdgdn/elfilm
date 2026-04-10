"""
Test and verify the ElFilm database
"""

import sqlite3

def verify_database():
    conn = sqlite3.connect('elfilm.db')
    cursor = conn.cursor()
    
    print("ElFilm Database Verification")
    print("=" * 60)
    
    # Count tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = cursor.fetchall()
    print(f"\n📊 Tables created: {len(tables)}")
    for table in tables:
        print(f"   - {table[0]}")
    
    # Count records
    print(f"\n📈 Record counts:")
    
    queries = [
        ("Movies", "SELECT COUNT(*) FROM movies"),
        ("People", "SELECT COUNT(*) FROM people"),
        ("Companies", "SELECT COUNT(*) FROM companies"),
        ("Genres", "SELECT COUNT(*) FROM genres"),
        ("Movie-Person relations", "SELECT COUNT(*) FROM movie_people"),
        ("Movie-Company relations", "SELECT COUNT(*) FROM movie_companies"),
        ("Movie-Genre links", "SELECT COUNT(*) FROM movie_genres"),
    ]
    
    for label, query in queries:
        cursor.execute(query)
        count = cursor.fetchone()[0]
        print(f"   {label:25} {count:>6,}")
    
    # Sample queries
    print(f"\n🎬 Sample Queries:")
    
    # Get a random movie with cast
    print("\n1. Random Movie with Cast:")
    cursor.execute("""
        SELECT m.title_ar, m.year, m.slug
        FROM movies m
        ORDER BY RANDOM()
        LIMIT 1
    """)
    movie = cursor.fetchone()
    if movie:
        title, year, slug = movie
        print(f"   Title: {title} ({year})")
        print(f"   Slug: {slug}")
        
        # Get cast for this movie
        cursor.execute("""
            SELECT p.name_ar, mp.role_kind
            FROM movie_people mp
            JOIN people p ON p.id = mp.person_id
            WHERE mp.movie_id IN (SELECT id FROM movies WHERE slug = ?)
            AND mp.role_kind = 'actor'
            LIMIT 5
        """, (slug,))
        
        cast = cursor.fetchall()
        if cast:
            print(f"   Cast ({len(cast)}):")
            for actor, _ in cast:
                print(f"      - {actor}")
    
    # Movies by decade
    print("\n2. Movies by Decade:")
    cursor.execute("""
        SELECT 
            (year / 10) * 10 as decade,
            COUNT(*) as count
        FROM movies
        GROUP BY decade
        ORDER BY decade
    """)
    
    for decade, count in cursor.fetchall():
        print(f"   {decade}s: {count:>3} movies")
    
    # Top genres
    print("\n3. Top Genres:")
    cursor.execute("""
        SELECT g.name_ar, COUNT(*) as count
        FROM genres g
        JOIN movie_genres mg ON mg.genre_id = g.id
        GROUP BY g.id
        ORDER BY count DESC
        LIMIT 5
    """)
    
    for genre, count in cursor.fetchall():
        print(f"   {genre:20} {count:>3} movies")
    
    # Most prolific actors
    print("\n4. Most Prolific Actors:")
    cursor.execute("""
        SELECT p.name_ar, COUNT(*) as film_count
        FROM people p
        JOIN movie_people mp ON mp.person_id = p.id
        WHERE mp.role_kind = 'actor'
        GROUP BY p.id
        ORDER BY film_count DESC
        LIMIT 5
    """)
    
    for actor, count in cursor.fetchall():
        print(f"   {actor:30} {count:>3} films")
    
    print("\n" + "=" * 60)
    print("✅ Database verification complete!")
    
    conn.close()

if __name__ == '__main__':
    verify_database()
