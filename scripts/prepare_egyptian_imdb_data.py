import hashlib
import json
import os
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "prepared_db"
MOVIE_SOURCES = [
    ROOT / "egyptian_movies_merged.json",
    ROOT / "egyptian_movies_clean.json",
    ROOT / "movies_master_r2.json",
    ROOT / "movies_unified_enriched.json",
]

SCHEMA_SQL = """
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
  year INTEGER,
  type TEXT,
  duration TEXT,
  duration_minutes INTEGER,
  poster_url TEXT,
  genres TEXT,
  summary_ar TEXT,
  story TEXT,
  country TEXT DEFAULT 'Egypt',
  language TEXT DEFAULT 'Arabic',
  dhliz_url TEXT,
  elcinema_url TEXT,
  rating REAL DEFAULT 0,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_movies_slug ON movies(slug);
CREATE INDEX idx_movies_year ON movies(year);
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
  country TEXT DEFAULT 'Egypt',
  profile_image TEXT,
  dhliz_url TEXT,
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
  country TEXT DEFAULT 'Egypt',
  founded_year INTEGER,
  closed_year INTEGER,
  description_ar TEXT,
  dhliz_url TEXT,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  url TEXT,
  r2_key TEXT,
  width INTEGER,
  height INTEGER,
  source TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE
);
CREATE INDEX idx_assets_movie ON assets(movie_id);
CREATE INDEX idx_assets_person ON assets(person_id);

CREATE TABLE watch_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movie_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
);

CREATE TABLE news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT DEFAULT 'movie',
  entity_id TEXT NOT NULL,
  category TEXT DEFAULT 'news',
  title TEXT,
  link TEXT,
  snippet TEXT,
  source TEXT
);
CREATE INDEX idx_news_entity ON news(entity_type, entity_id);

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
"""


def read_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def h(value, n=10):
    return hashlib.sha1(str(value).encode("utf-8")).hexdigest()[:n]


def sql(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("\x00", "").strip().replace("'", "''") + "'"


def slugify(value, fallback):
    text = str(value or "").lower().replace("_", "-")
    text = re.sub(r"[^a-z0-9-]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return (text or fallback)[:90]


def unique_slug(value, used, fallback):
    base = slugify(value, fallback)
    slug = base
    i = 2
    while slug in used:
        slug = f"{base}-{i}"
        i += 1
    used.add(slug)
    return slug


def parse_title_year(movie):
    title = str(movie.get("title") or movie.get("title_ar") or "").strip()
    year = None
    if movie.get("year") not in (None, ""):
        match = re.search(r"(19|20)\d{2}", str(movie.get("year")))
        if match:
            year = int(match.group(0))
    match = re.search(r"\((19|20)\d{2}\)\s*$", title)
    if match:
        year = year or int(match.group(0).strip("()"))
        title = re.sub(r"\s*\((19|20)\d{2}\)\s*$", "", title).strip()
    return title, year


def normalize_date(value):
    if not value:
        return None
    text = str(value)
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if match:
        day, month, year = match.groups()
        return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    match = re.search(r"\b(18|19|20)\d{2}\b", text)
    return match.group(0) if match else None


def first_snippet(items):
    if not isinstance(items, list):
        return None
    for item in items:
        if isinstance(item, dict) and item.get("snippet"):
            return str(item["snippet"]).strip()
    return None


def source_for(movie):
    source = str(movie.get("source") or "").strip()
    if source:
        return source
    url = str(movie.get("url") or "")
    if "dhliz.com" in url:
        return "dhliz"
    if "elcinema.com" in url:
        return "elcinema"
    return "unknown"


def duration_minutes(movie):
    value = movie.get("duration_minutes") or movie.get("duration") or movie.get("duration_str")
    match = re.search(r"\d+", str(value or ""))
    return int(match.group(0)) if match else None


def role_kind(role):
    role = str(role or "")
    if "إخراج" in role or "مخرج" in role:
        return "director"
    if any(x in role for x in ["تأليف", "سيناريو", "قصة", "حوار", "كتابة"]):
        return "writer"
    if "إنتاج" in role or "منتج" in role:
        return "producer"
    if "تصوير" in role:
        return "cinematographer"
    if "مونتاج" in role:
        return "editor"
    if "موسيقى" in role or "ألحان" in role:
        return "composer"
    return "crew"


class SeedWriter:
    def __init__(self, out_dir, max_bytes=4_000_000):
        self.out_dir = out_dir
        self.max_bytes = max_bytes
        self.files = []
        self.handle = None
        self.size = 0
        self.index = -1
        self.next()

    def next(self):
        if self.handle:
            self.handle.write("PRAGMA foreign_keys = ON;\n")
            self.handle.close()
        self.index += 1
        path = self.out_dir / f"seed_{self.index:03d}.sql"
        self.files.append(path.name)
        self.handle = path.open("w", encoding="utf-8")
        header = "-- Egyptian IMDb seed data\nPRAGMA foreign_keys = OFF;\n\n"
        self.handle.write(header)
        self.size = len(header.encode("utf-8"))

    def write(self, text):
        size = len(text.encode("utf-8"))
        if self.size + size > self.max_bytes and self.size:
            self.next()
        self.handle.write(text)
        self.size += size

    def close(self):
        if self.handle:
            self.handle.write("PRAGMA foreign_keys = ON;\n")
            self.handle.close()


def insert_many(writer, table, columns, rows, batch_size=250):
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        values = ",\n".join("(" + ", ".join(sql(v) for v in row) + ")" for row in batch)
        writer.write(f"INSERT OR IGNORE INTO {table} ({', '.join(columns)}) VALUES\n{values};\n\n")


def movie_id(movie, title, year):
    if movie.get("id"):
        return str(movie["id"]).strip()
    url = str(movie.get("url") or "").strip().rstrip("/")
    if url:
        return url.split("/")[-1]
    return f"movie-{h(f'{title}-{year}')}"


def main():
    movies_file = next(path for path in MOVIE_SOURCES if path.exists())
    movies_raw = read_json(movies_file)
    people_raw = read_json(ROOT / "people_master.json") if (ROOT / "people_master.json").exists() else []
    companies_raw = read_json(ROOT / "companies_master.json") if (ROOT / "companies_master.json").exists() else []

    used_movie_slugs, used_person_slugs, used_company_slugs = set(), set(), set()
    seen_movies = set()
    movies, genres, movie_genres = [], {}, set()
    people, companies = {}, {}
    movie_people, movie_companies = {}, set()
    watch_links, assets, news, search = [], [], [], []

    for p in people_raw:
        pid = str(p.get("id") or "").strip()
        name = str(p.get("name_ar") or p.get("name") or "").strip()
        if not pid or not name:
            continue
        people[pid] = {
            "id": pid,
            "slug": unique_slug(pid, used_person_slugs, f"person-{h(pid)}"),
            "name_ar": name,
            "name_en": p.get("name_en"),
            "full_name": p.get("full_name"),
            "bio_ar": first_snippet(p.get("bio_search")),
            "bio": first_snippet(p.get("bio_search")),
            "birthdate": normalize_date(p.get("birthdate")),
            "deathdate": normalize_date(p.get("deathdate")),
            "country": "Egypt",
            "profile_image": p.get("profile_image") or p.get("image_url"),
            "dhliz_url": p.get("url"),
        }
        for item in p.get("news") or []:
            if isinstance(item, dict):
                news.append(("person", pid, "news", item.get("title"), item.get("link"), item.get("snippet"), "exa"))

    for c in companies_raw:
        cid = str(c.get("id") or "").strip()
        name = str(c.get("name_ar") or c.get("name") or "").strip()
        if not cid or not name:
            continue
        companies[cid] = {
            "id": cid,
            "slug": unique_slug(cid, used_company_slugs, f"company-{h(cid)}"),
            "name_ar": name,
            "name_en": c.get("name_en"),
            "kind": c.get("kind") or "production",
            "country": "Egypt",
            "founded_year": c.get("founded_year"),
            "closed_year": c.get("closed_year"),
            "description_ar": c.get("description_ar"),
            "dhliz_url": c.get("url"),
        }

    for movie in movies_raw:
        title, year = parse_title_year(movie)
        if not title:
            continue
        mid_base = movie_id(movie, title, year)
        mid = mid_base if mid_base not in seen_movies else f"{mid_base}-{h(title + str(year), 6)}"
        if mid in seen_movies:
            continue
        seen_movies.add(mid)

        url = movie.get("url")
        source = source_for(movie)
        source_slug = str(url or "").rstrip("/").split("/")[-1] if url else mid
        slug = unique_slug(source_slug or mid, used_movie_slugs, f"movie-{h(mid)}")
        story = movie.get("story") or movie.get("summary_ar")
        genre_names = []
        for g in movie.get("genres") or []:
            name = str(g).strip()
            if not name:
                continue
            if name not in genres:
                genres[name] = len(genres) + 1
            movie_genres.add((mid, genres[name]))
            genre_names.append(name)

        poster = movie.get("poster_url")
        movies.append({
            "id": mid,
            "slug": slug,
            "title": title,
            "title_ar": title,
            "title_en": movie.get("title_en"),
            "year": year,
            "type": movie.get("type"),
            "duration": movie.get("duration") or movie.get("duration_str"),
            "duration_minutes": duration_minutes(movie),
            "poster_url": poster,
            "genres": ",".join(genre_names),
            "summary_ar": story,
            "story": story,
            "country": movie.get("country") or "Egypt",
            "language": movie.get("language") or "Arabic",
            "dhliz_url": url if source == "dhliz" else None,
            "elcinema_url": url if source == "elcinema" else movie.get("elcinema_url"),
            "rating": movie.get("rating") if movie.get("rating") != "" else None,
            "source": source,
        })
        if poster:
            assets.append((mid, None, "poster", poster, None, None, None, source))

        cast_names, crew_names = [], []
        for order, cast in enumerate(movie.get("cast") or [], 1):
            if not isinstance(cast, dict) or not cast.get("name"):
                continue
            pid = str(cast.get("id") or f"person-{h(cast.get('name'))}").strip()
            cast_names.append(cast["name"])
            people.setdefault(pid, {
                "id": pid,
                "slug": unique_slug(pid, used_person_slugs, f"person-{h(pid)}"),
                "name_ar": cast["name"],
                "name_en": cast.get("name_en"),
                "full_name": None,
                "bio_ar": None,
                "bio": None,
                "birthdate": None,
                "deathdate": None,
                "country": "Egypt",
                "profile_image": cast.get("image_url"),
                "dhliz_url": None,
            })
            movie_people.setdefault((mid, pid, "actor", ""), order)

        for order, crew in enumerate(movie.get("crew") or [], 1):
            if not isinstance(crew, dict) or not crew.get("id") or not crew.get("name"):
                continue
            eid = str(crew["id"]).strip()
            credit = str(crew.get("role") or "").strip()
            kind = role_kind(credit)
            if crew.get("type") == "company":
                companies.setdefault(eid, {
                    "id": eid,
                    "slug": unique_slug(eid, used_company_slugs, f"company-{h(eid)}"),
                    "name_ar": crew["name"],
                    "name_en": crew.get("name_en"),
                    "kind": kind,
                    "country": "Egypt",
                    "founded_year": None,
                    "closed_year": None,
                    "description_ar": None,
                    "dhliz_url": None,
                })
                movie_companies.add((mid, eid, kind))
            else:
                crew_names.append(crew["name"])
                people.setdefault(eid, {
                    "id": eid,
                    "slug": unique_slug(eid, used_person_slugs, f"person-{h(eid)}"),
                    "name_ar": crew["name"],
                    "name_en": crew.get("name_en"),
                    "full_name": None,
                    "bio_ar": None,
                    "bio": None,
                    "birthdate": None,
                    "deathdate": None,
                    "country": "Egypt",
                    "profile_image": crew.get("image_url"),
                    "dhliz_url": None,
                })
                movie_people.setdefault((mid, eid, kind, credit), order)

        for link in movie.get("watch_links") or movie.get("streaming_links") or []:
            if isinstance(link, dict) and link.get("url"):
                watch_links.append((mid, link.get("platform") or "unknown", link.get("url"), link.get("title")))
        for category in ("news", "reviews"):
            for item in movie.get(category) or []:
                if isinstance(item, dict):
                    news.append(("movie", mid, "review" if category == "reviews" else "news", item.get("title"), item.get("link"), item.get("snippet"), "exa"))
        search.append((mid, title, title, movie.get("title_en"), story, story, " ".join(genre_names), " ".join(cast_names), " ".join(crew_names)))

    OUT.mkdir(exist_ok=True)
    (OUT / "schema.sql").write_text(SCHEMA_SQL.strip() + "\n", encoding="utf-8")
    for path in OUT.glob("seed*.sql"):
        path.unlink()

    movie_rows = [tuple(m[k] for k in ("id", "slug", "title", "title_ar", "title_en", "year", "type", "duration", "duration_minutes", "poster_url", "genres", "summary_ar", "story", "country", "language", "dhliz_url", "elcinema_url", "rating", "source")) for m in movies]
    person_rows = [tuple(p[k] for k in ("id", "slug", "name_ar", "name_en", "full_name", "bio_ar", "bio", "birthdate", "deathdate", "country", "profile_image", "dhliz_url")) for p in people.values()]
    company_rows = [tuple(c[k] for k in ("id", "slug", "name_ar", "name_en", "kind", "country", "founded_year", "closed_year", "description_ar", "dhliz_url")) for c in companies.values()]
    genre_rows = [(gid, unique_slug(name, set(), f"genre-{gid}"), name, None) for name, gid in sorted(genres.items(), key=lambda x: x[1])]
    credit_rows = sorted((*key, order) for key, order in movie_people.items())

    batches = [
        ("movies", ["id", "slug", "title", "title_ar", "title_en", "year", "type", "duration", "duration_minutes", "poster_url", "genres", "summary_ar", "story", "country", "language", "dhliz_url", "elcinema_url", "rating", "source"], movie_rows),
        ("people", ["id", "slug", "name_ar", "name_en", "full_name", "bio_ar", "bio", "birthdate", "deathdate", "country", "profile_image", "dhliz_url"], person_rows),
        ("companies", ["id", "slug", "name_ar", "name_en", "kind", "country", "founded_year", "closed_year", "description_ar", "dhliz_url"], company_rows),
        ("genres", ["id", "slug", "name_ar", "name_en"], genre_rows),
        ("movie_genres", ["movie_id", "genre_id"], sorted(movie_genres)),
        ("movie_people", ["movie_id", "person_id", "role_kind", "role_credit", "billing_order"], credit_rows),
        ("movie_companies", ["movie_id", "company_id", "role_kind"], sorted(movie_companies)),
        ("watch_links", ["movie_id", "platform", "url", "title"], watch_links),
        ("assets", ["movie_id", "person_id", "kind", "url", "r2_key", "width", "height", "source"], assets),
        ("news", ["entity_type", "entity_id", "category", "title", "link", "snippet", "source"], news),
        ("movie_search", ["movie_id", "title", "title_ar", "title_en", "summary_ar", "story", "genres", "cast_names", "crew_names"], search),
    ]

    writer = SeedWriter(OUT)
    try:
        for table, cols, rows in batches:
            insert_many(writer, table, cols, rows)
    finally:
        writer.close()

    summary = {
        "movies_source": str(movies_file.relative_to(ROOT)),
        "output_dir": str(OUT.relative_to(ROOT)),
        "files": ["schema.sql", *writer.files],
        "counts": {
            "movies": len(movie_rows),
            "people": len(person_rows),
            "companies": len(company_rows),
            "genres": len(genre_rows),
            "movie_genres": len(movie_genres),
            "movie_people": len(credit_rows),
            "movie_companies": len(movie_companies),
            "watch_links": len(watch_links),
            "assets": len(assets),
            "news": len(news),
            "movie_search": len(search),
        },
    }
    (OUT / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    os.chdir(ROOT)
    main()
