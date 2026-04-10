

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
    