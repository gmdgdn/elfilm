-- ElFilm D1 Database Schema
-- Production-ready schema for Egyptian films database

-- Films table
CREATE TABLE IF NOT EXISTS films (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  production_year INTEGER NOT NULL,
  film_type TEXT,
  duration_minutes INTEGER,
  summary_ar TEXT,
  poster_url TEXT,
  poster_r2_key TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on year for efficient filtering
CREATE INDEX IF NOT EXISTS idx_films_year ON films(production_year);
CREATE INDEX IF NOT EXISTS idx_films_slug ON films(slug);
CREATE INDEX IF NOT EXISTS idx_films_title_en ON films(title_en);

-- Genres table
CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT UNIQUE NOT NULL,
  name_ar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Film-Genre junction table
CREATE TABLE IF NOT EXISTS film_genres (
  film_id INTEGER NOT NULL,
  genre_id INTEGER NOT NULL,
  PRIMARY KEY (film_id, genre_id),
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT UNIQUE,
  name_ar TEXT UNIQUE,
  category TEXT DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Film-Tag junction table
CREATE TABLE IF NOT EXISTS film_tags (
  film_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  language TEXT DEFAULT 'en',
  PRIMARY KEY (film_id, tag_id, language),
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- People table (cast and crew)
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT NOT NULL,
  name_ar TEXT,
  birth_year INTEGER,
  bio_en TEXT,
  bio_ar TEXT,
  image_url TEXT,
  image_r2_key TEXT,
  imdb_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on person names
CREATE INDEX IF NOT EXISTS idx_people_name_en ON people(name_en);
CREATE INDEX IF NOT EXISTS idx_people_name_ar ON people(name_ar);

-- Cast table
CREATE TABLE IF NOT EXISTS cast (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  role_name TEXT,
  imdb_rating REAL,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  UNIQUE(film_id, person_id)
);

-- Create index for efficient cast lookup
CREATE INDEX IF NOT EXISTS idx_cast_film ON cast(film_id);
CREATE INDEX IF NOT EXISTS idx_cast_person ON cast(person_id);

-- Crew roles enumeration (director, screenwriter, producer, etc.)
CREATE TABLE IF NOT EXISTS crew_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_en TEXT UNIQUE NOT NULL,
  name_ar TEXT,
  category TEXT DEFAULT 'production',
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Crew table
CREATE TABLE IF NOT EXISTS crew (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  crew_role_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  FOREIGN KEY (crew_role_id) REFERENCES crew_roles(id) ON DELETE RESTRICT,
  UNIQUE(film_id, person_id, crew_role_id)
);

-- Create index for efficient crew lookup
CREATE INDEX IF NOT EXISTS idx_crew_film ON crew(film_id);
CREATE INDEX IF NOT EXISTS idx_crew_person ON crew(person_id);
CREATE INDEX IF NOT EXISTS idx_crew_role ON crew(crew_role_id);

-- Search history and analytics
CREATE TABLE IF NOT EXISTS search_queries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_count INTEGER,
  language TEXT DEFAULT 'en',
  ip_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User preferences (for future features)
CREATE TABLE IF NOT EXISTS user_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  rating REAL NOT NULL,
  review TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  UNIQUE(film_id, user_id)
);

-- Watchlist (for future features)
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  film_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending',
  watched_at DATETIME,
  FOREIGN KEY (film_id) REFERENCES films(id) ON DELETE CASCADE,
  UNIQUE(film_id, user_id)
);

-- Seed crew roles
INSERT OR IGNORE INTO crew_roles (name_en, name_ar, category, display_order) VALUES
  ('Director', 'مخرج', 'direction', 1),
  ('Screenwriter', 'كاتب السيناريو', 'writing', 2),
  ('Screenplay', 'سيناريو', 'writing', 3),
  ('Dialogue', 'حوار', 'writing', 4),
  ('Producer', 'منتج', 'production', 5),
  ('Assistant Director', 'مساعد مخرج', 'direction', 6),
  ('Cinematography', 'تصوير', 'technical', 7),
  ('Photography', 'تصوير', 'technical', 8),
  ('Art Director', 'مصمم الديكور', 'design', 9),
  ('Music', 'موسيقى', 'sound', 10),
  ('Composer', 'موسيقار', 'sound', 11),
  ('Sound', 'صوت', 'sound', 12),
  ('Sound Engineer', 'مهندس صوت', 'sound', 13),
  ('Montage', 'مونتاج', 'editing', 14),
  ('Editor', 'محرر', 'editing', 15),
  ('Makeup', 'مكياج', 'design', 16),
  ('Costumes', 'ملابس', 'design', 17);

-- Seed common genres
INSERT OR IGNORE INTO genres (name_en, name_ar) VALUES
  ('Comedy', 'كوميديا'),
  ('Drama', 'درام'),
  ('Thriller', 'إثارة'),
  ('Romance', 'رومانسي'),
  ('Action', 'أكشن'),
  ('Crime', 'جريمة'),
  ('Mystery', 'غموض'),
  ('Horror', 'رعب'),
  ('Documentary', 'وثائقي'),
  ('Historical', 'تاريخي'),
  ('Musical', 'موسيقي'),
  ('Adventure', 'مغامرة'),
  ('Fantasy', 'خيال'),
  ('War', 'حرب'),
  ('Animation', 'رسوم متحركة');
