-- ElFilm public schema
-- Clean production schema for the public ElFilm dataset.
-- Source URLs and source-domain columns are intentionally excluded.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS movie_search;
DROP TABLE IF EXISTS news;
DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS watch_links;
DROP TABLE IF EXISTS movie_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS movie_companies;
DROP TABLE IF EXISTS movie_people;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS movies;

CREATE TABLE movies (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    title_ar TEXT NOT NULL,
    title_en TEXT,
    year INTEGER NOT NULL DEFAULT 0,
    work_type TEXT DEFAULT 'فيلم',
    work_subtype TEXT,
    duration TEXT,
    duration_minutes INTEGER,
    poster_url TEXT,
    genres TEXT,
    summary_ar TEXT,
    story TEXT,
    country TEXT DEFAULT 'مصر',
    language TEXT DEFAULT 'العربية',
    rating REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movies_slug ON movies(slug);
CREATE INDEX idx_movies_year ON movies(year);
CREATE INDEX idx_movies_rating ON movies(rating);
CREATE INDEX idx_movies_title ON movies(title COLLATE NOCASE);
CREATE INDEX idx_movies_title_ar ON movies(title_ar COLLATE NOCASE);

CREATE TABLE people (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    full_name TEXT,
    bio_ar TEXT,
    bio TEXT,
    birthdate TEXT,
    deathdate TEXT,
    country TEXT DEFAULT 'مصر',
    profile_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_people_slug ON people(slug);
CREATE INDEX idx_people_name_ar ON people(name_ar COLLATE NOCASE);
CREATE INDEX idx_people_name_en ON people(name_en COLLATE NOCASE);
CREATE INDEX idx_people_birthdate ON people(birthdate);
CREATE INDEX idx_people_deathdate ON people(deathdate);

CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    kind TEXT,
    country TEXT DEFAULT 'مصر',
    founded_year INTEGER,
    closed_year INTEGER,
    description_ar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_name_ar ON companies(name_ar COLLATE NOCASE);

CREATE TABLE movie_people (
    movie_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    role_kind TEXT NOT NULL,
    role_credit TEXT NOT NULL DEFAULT '',
    billing_order INTEGER DEFAULT 999,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, person_id, role_kind, role_credit)
);

CREATE INDEX idx_movie_people_movie ON movie_people(movie_id);
CREATE INDEX idx_movie_people_person ON movie_people(person_id);
CREATE INDEX idx_movie_people_role ON movie_people(role_kind);

CREATE TABLE movie_companies (
    movie_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    role_kind TEXT NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, company_id, role_kind)
);

CREATE INDEX idx_movie_companies_movie ON movie_companies(movie_id);
CREATE INDEX idx_movie_companies_company ON movie_companies(company_id);

CREATE TABLE genres (
    id INTEGER PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT
);

CREATE TABLE movie_genres (
    movie_id TEXT NOT NULL,
    genre_id INTEGER NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

CREATE INDEX idx_movie_genres_movie ON movie_genres(movie_id);
CREATE INDEX idx_movie_genres_genre ON movie_genres(genre_id);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category TEXT
);

CREATE TABLE movie_tags (
    movie_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, tag_id)
);

CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id TEXT,
    person_id TEXT,
    kind TEXT NOT NULL,
    url TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE INDEX idx_assets_movie ON assets(movie_id);
CREATE INDEX idx_assets_person ON assets(person_id);
CREATE INDEX idx_assets_kind ON assets(kind);

CREATE TABLE watch_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id TEXT NOT NULL,
    provider_key TEXT,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    embed_url TEXT,
    embed_type TEXT DEFAULT 'external',
    source_kind TEXT DEFAULT 'manual',
    title TEXT,
    confidence REAL,
    verified_at TEXT,
    is_official INTEGER DEFAULT 0,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE INDEX idx_watch_links_movie ON watch_links(movie_id);
CREATE INDEX idx_watch_links_provider ON watch_links(provider_key);

CREATE TABLE news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT DEFAULT 'movie',
    entity_id TEXT NOT NULL,
    category TEXT DEFAULT 'news',
    title TEXT,
    link TEXT,
    domain TEXT,
    snippet TEXT,
    published_at TEXT
);

CREATE INDEX idx_news_entity ON news(entity_type, entity_id);
CREATE INDEX idx_news_category ON news(category);

CREATE VIRTUAL TABLE movie_search USING fts5(
    movie_id UNINDEXED,
    title,
    title_ar,
    title_en,
    summary_ar,
    story,
    genres,
    cast_names,
    crew_names
);

PRAGMA foreign_keys = ON;
