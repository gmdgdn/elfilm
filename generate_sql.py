import json
import os

def escape_sql(text):
    if text is None:
        return "NULL"
    return "'" + str(text).replace("'", "''") + "'"

def generate_sql():
    # 1. Schema
    schema = """

-- Drop legacy tables
DROP TABLE IF EXISTS movie_people;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS movie_tags;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS watchlinks; -- just in case
DROP TABLE IF EXISTS movie_search;
DROP TABLE IF EXISTS movie_search_data;
DROP TABLE IF EXISTS movie_search_idx;
DROP TABLE IF EXISTS movie_search_docsize;
DROP TABLE IF EXISTS movie_search_config;

-- Drop new schema tables
DROP TABLE IF EXISTS "cast";
DROP TABLE IF EXISTS crew;
DROP TABLE IF EXISTS movie_companies;
DROP TABLE IF EXISTS watch_links;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS companies;

CREATE TABLE movies (
    id TEXT PRIMARY KEY,
    title TEXT,
    year INTEGER,
    poster_url TEXT,
    story TEXT,
    duration TEXT,
    rating TEXT,
    genres TEXT
);

CREATE TABLE people (
    id TEXT PRIMARY KEY,
    name_ar TEXT,
    name_en TEXT,
    birthdate TEXT,
    deathdate TEXT,
    profile_image TEXT,
    bio TEXT
);

CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name_ar TEXT,
    name_en TEXT,
    description TEXT
);

CREATE TABLE "cast" (
    movie_id TEXT,
    person_id TEXT,
    role TEXT
);

CREATE TABLE crew (
    movie_id TEXT,
    person_id TEXT,
    role TEXT
);

CREATE TABLE movie_companies (
    movie_id TEXT,
    company_id TEXT,
    role TEXT
);

CREATE TABLE watch_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id TEXT,
    platform TEXT,
    url TEXT,
    title TEXT
);

CREATE TABLE news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id TEXT, -- movie_id, person_id, or company_id
    title TEXT,
    link TEXT,
    snippet TEXT
);
    """
    
    with open("schema.sql", "w", encoding="utf-8") as f:
        f.write(schema)
        
    print("Generated schema.sql")
    
    # 2. Seed Data
    # Split into multiple files to avoid D1 limits
    
    current_file_index = 0
    current_file = None
    statements_in_file = 0
    MAX_STMTS_PER_FILE = 100 # Conservative limit
    
    def get_file():
        nonlocal current_file, current_file_index, statements_in_file
        if current_file is None:
            filename = f"seed_{current_file_index}.sql"
            current_file = open(filename, "w", encoding="utf-8")
            current_file.write("-- Seed data part " + str(current_file_index) + "\n")
            current_file.write("PRAGMA defer_foreign_keys=TRUE;\n")
            print(f"Created {filename}")
        
        if statements_in_file >= MAX_STMTS_PER_FILE:
            current_file.close()
            current_file_index += 1
            statements_in_file = 0
            filename = f"seed_{current_file_index}.sql"
            current_file = open(filename, "w", encoding="utf-8")
            current_file.write("-- Seed data part " + str(current_file_index) + "\n")
            current_file.write("PRAGMA defer_foreign_keys=TRUE;\n")
            print(f"Created {filename}")
            
        return current_file

    def write_stmt(stmt):
        nonlocal statements_in_file
        f = get_file()
        f.write(stmt)
        statements_in_file += 1

    # Helper for bulk writes
    def write_bulk_insert(table, columns, values_list, batch_size=50):
        if not values_list: return
        
        for i in range(0, len(values_list), batch_size):
            batch = values_list[i:i+batch_size]
            values_str = ",\n".join([f"({v})" for v in batch])
            stmt = f"INSERT OR IGNORE INTO {table} ({columns}) VALUES \n{values_str};\n"


    # Load Movies (Unified Enriched)
    if os.path.exists("movies_unified_enriched.json"):
        with open("movies_unified_enriched.json", "r", encoding="utf-8") as mf:
            movies = json.load(mf)
            process_movies_bulk(write_bulk_insert, movies)
    else:
        print("movies_unified_enriched.json not found!")
        
    if current_file:
        current_file.close()

    print("Generated seed files.")

def process_movies_bulk(write_func, movies):
    movie_values = []
    cast_values = []
    crew_values = []
    mc_values = []
    wl_values = []
    news_values = []
    
    def flush_batches():
        nonlocal movie_values, cast_values, crew_values, mc_values, wl_values, news_values
        write_func("movies", "id, title, year, poster_url, story, duration, rating, genres", movie_values)
        write_func("\"cast\"", "movie_id, person_id, role", cast_values)
        write_func("crew", "movie_id, person_id, role", crew_values)
        write_func("movie_companies", "movie_id, company_id, role", mc_values)
        write_func("watch_links", "movie_id, platform, url, title", wl_values)
        write_func("news", "entity_id, title, link, snippet", news_values)
        
        movie_values = []
        cast_values = []
        crew_values = []
        mc_values = []
        wl_values = []
        news_values = []

    for i, m in enumerate(movies):
        mid = m.get('url', '').split('/')[-2]
        if not mid: continue
        
        mid_sql = escape_sql(mid)
        title = escape_sql(m.get('title'))
        year = escape_sql(m.get('year'))
        poster = escape_sql(m.get('poster_url'))
        story = escape_sql(m.get('story'))
        duration = escape_sql(m.get('duration'))
        rating = escape_sql(m.get('rating'))
        genres = escape_sql(",".join(m.get('genres', [])))
        
        movie_values.append(f"{mid_sql}, {title}, {year}, {poster}, {story}, {duration}, {rating}, {genres}")
        
        for cast in m.get('cast', []):
            pid = escape_sql(cast.get('id'))
            role = "NULL"
            if cast.get('type') == 'person':
                cast_values.append(f"{mid_sql}, {pid}, {role}")
        
        for crew in m.get('crew', []):
            cid = escape_sql(crew.get('id'))
            role = escape_sql(crew.get('role'))
            if crew.get('type') == 'person':
                crew_values.append(f"{mid_sql}, {cid}, {role}")
            elif crew.get('type') == 'company':
                mc_values.append(f"{mid_sql}, {cid}, {role}")

        for link in m.get('watch_links', []):
            platform = escape_sql(link.get('platform'))
            url = escape_sql(link.get('url'))
            title = escape_sql(link.get('title'))
            wl_values.append(f"{mid_sql}, {platform}, {url}, {title}")

        for news in m.get('news', []):
            title = escape_sql(news.get('title'))
            link = escape_sql(news.get('link'))
            snippet = escape_sql(news.get('snippet'))
            news_values.append(f"{mid_sql}, {title}, {link}, {snippet}")
            
        # Flush every 500 movies
        if i % 500 == 0:
            flush_batches()
            
    # Final flush
    flush_batches()

if __name__ == "__main__":
    generate_sql()
