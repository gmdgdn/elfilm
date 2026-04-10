-- ElFilm D1 Database Schema
-- Migration 001: Create core tables

-- ============================================================
-- CORE ENTITIES
-- ============================================================

-- Movies table
CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title_en TEXT,
    title_ar TEXT NOT NULL,
    year INTEGER NOT NULL,
    type TEXT, -- "Black and White", "Color", etc.
    duration_minutes INTEGER,
    summary_ar TEXT,
    country TEXT DEFAULT 'Egypt',
    language TEXT DEFAULT 'Arabic',
    dhliz_url TEXT,
    rating REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_title_ar ON movies(title_ar COLLATE NOCASE);

-- People table
CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_en TEXT,
    name_ar TEXT NOT NULL,
    full_name TEXT,
    bio_ar TEXT,
    birthdate TEXT,
    deathdate TEXT,
    country TEXT DEFAULT 'Egypt',
    profile_image TEXT,
    dhliz_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_people_slug ON people(slug);
CREATE INDEX IF NOT EXISTS idx_people_name_ar ON people(name_ar COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_people_name_en ON people(name_en COLLATE NOCASE);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_en TEXT,
    name_ar TEXT NOT NULL,
    kind TEXT, -- "production", "distribution", "studio", "lab"
    country TEXT DEFAULT 'Egypt',
    founded_year INTEGER,
    closed_year INTEGER,
    description_ar TEXT,
    dhliz_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_name_ar ON companies(name_ar COLLATE NOCASE);

-- ============================================================
-- RELATIONSHIP TABLES
-- ============================================================

-- Movie-Person relations (credits)
CREATE TABLE IF NOT EXISTS movie_people (
    movie_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    role_kind TEXT NOT NULL, -- "actor", "director", "writer", "producer", etc.
    role_credit TEXT DEFAULT '', -- specific credit like "screenplay", "dialogue"
    billing_order INTEGER DEFAULT 999,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, person_id, role_kind, role_credit)
);

CREATE INDEX IF NOT EXISTS idx_movie_people_movie ON movie_people(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_people_person ON movie_people(person_id);
CREATE INDEX IF NOT EXISTS idx_movie_people_role ON movie_people(role_kind);

-- Movie-Company relations
CREATE TABLE IF NOT EXISTS movie_companies (
    movie_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    role_kind TEXT NOT NULL, -- "producer", "distributor", "studio"
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, company_id, role_kind)
);

CREATE INDEX IF NOT EXISTS idx_movie_companies_movie ON movie_companies(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_companies_company ON movie_companies(company_id);

-- ============================================================
-- TAXONOMY TABLES
-- ============================================================

-- Genres
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_en TEXT,
    name_ar TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id TEXT NOT NULL,
    genre_id INTEGER NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_genres_movie ON movie_genres(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_genres_genre ON movie_genres(genre_id);

-- Tags (semantic discovery)
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name_en TEXT,
    name_ar TEXT NOT NULL,
    category TEXT -- "theme", "location", "occupation", "relationship"
);

CREATE TABLE IF NOT EXISTS movie_tags (
    movie_id TEXT NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_movie_tags_movie ON movie_tags(movie_id);
CREATE INDEX IF NOT EXISTS idx_movie_tags_tag ON movie_tags(tag_id);

-- ============================================================
-- ASSET & MEDIA TABLES
-- ============================================================

-- Assets (R2 references)
CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id TEXT,
    person_id TEXT,
    kind TEXT NOT NULL, -- "poster", "still", "frame", "portrait"
    r2_key TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    source TEXT DEFAULT 'dhliz',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_movie ON assets(movie_id);
CREATE INDEX IF NOT EXISTS idx_assets_person ON assets(person_id);
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);

-- Watch links (YouTube, etc.)
CREATE TABLE IF NOT EXISTS watch_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_watch_links_movie ON watch_links(movie_id);

-- ============================================================
-- FULL-TEXT SEARCH
-- ============================================================

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS movie_search USING fts5(
    movie_id UNINDEXED,
    title_en,
    title_ar,
    summary_ar,
    tags_en,
    tags_ar,
    cast_names,
    crew_names,
    content='movies',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS movies_ai AFTER INSERT ON movies BEGIN
  INSERT INTO movie_search(movie_id, title_en, title_ar, summary_ar)
  VALUES (new.id, new.title_en, new.title_ar, new.summary_ar);
END;

CREATE TRIGGER IF NOT EXISTS movies_ad AFTER DELETE ON movies BEGIN
  DELETE FROM movie_search WHERE movie_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS movies_au AFTER UPDATE ON movies BEGIN
  UPDATE movie_search SET 
    title_en = new.title_en,
    title_ar = new.title_ar,
    summary_ar = new.summary_ar
  WHERE movie_id = new.id;
END;
