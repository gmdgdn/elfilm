#!/usr/bin/env python3
"""
Prepare the clean ElFilm public dataset for Cloudflare D1.

Inputs:
  public_data/elfilm_movies_public.json
  public_data/elfilm_people_public.json

Outputs:
  prepared_cloudflare/schema.sql
  prepared_cloudflare/seed_000.sql ...
  prepared_cloudflare/summary.json
  elfilm_public.db (optional local validation database)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MOVIES = ROOT / "public_data" / "elfilm_movies_public.json"
DEFAULT_PEOPLE = ROOT / "public_data" / "elfilm_people_public.json"
DEFAULT_SCHEMA = ROOT / "migrations" / "003_public_elfilm_schema.sql"
DEFAULT_OUTPUT = ROOT / "prepared_cloudflare"
DEFAULT_DB = ROOT / "elfilm_public.db"
ASSET_MARKER = "/assets/elfilm/"

GENRE_PRIORITY = [
    "ﺩﺭاﻣﺎ",
    "ﻛﻮﻣﻴﺪﻱ",
    "أكشن",
    "ﺭﻭﻣﺎﻧﺴﻲ",
    "تاريخي",
]


def sql_value(value: Any) -> str:
    if value is None or value == "":
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).replace("'", "''")
    return f"'{text}'"


def parse_year(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def clean_role(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def actor_credit(role: str) -> str:
    return "" if "ﺗﻤﺜﻴﻞ" in role or "تمثيل" in role else role


def map_role_kind(role: str) -> str:
    if not role:
        return "crew"
    if "مخرج" in role or "إخراج" in role:
        return "director"
    if any(word in role for word in ["مؤلف", "تأليف", "قصة", "سيناريو", "حوار", "مقتبس", "اقتباس"]):
        return "writer"
    if any(word in role for word in ["منتج", "إنتاج"]):
        return "producer"
    if any(word in role for word in ["مونتير", "مونتاج", "مركب"]):
        return "editor"
    if any(word in role for word in ["تصوير", "مصور"]):
        return "cinematography"
    if any(word in role for word in ["موسيقى", "ألحان", "الألحان", "غناء", "كلمات"]):
        return "music"
    if any(word in role for word in ["صوت", "دوبلاج"]):
        return "sound"
    if any(word in role for word in ["ديكور", "مناظر", "إكسسوار"]):
        return "art"
    if any(word in role for word in ["ماكيير", "ماكياج", "مصفف", "ملابس"]):
        return "makeup_costume"
    if "موزع" in role:
        return "distribution"
    return "crew"


def asset_key_from_url(url: str | None) -> str | None:
    if not url or ASSET_MARKER not in url:
        return None
    return "assets/elfilm/" + url.split(ASSET_MARKER, 1)[1]


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON array")
    return data


def build_genres(movies: list[dict[str, Any]]) -> dict[str, int]:
    genre_names = {genre for movie in movies for genre in movie.get("genres", []) if genre}
    ordered = [genre for genre in GENRE_PRIORITY if genre in genre_names]
    ordered.extend(sorted(genre_names - set(ordered)))
    return {genre: index + 1 for index, genre in enumerate(ordered)}


def iter_movie_people(movie: dict[str, Any]):
    crew_keys = {
        (entry.get("person_id"), clean_role(entry.get("role")))
        for entry in movie.get("crew", [])
        if entry.get("person_id")
    }
    seen: set[tuple[str, str, str]] = set()

    for order, entry in enumerate(movie.get("cast", []), start=1):
        person_id = entry.get("person_id")
        if not person_id:
            continue
        role = clean_role(entry.get("role"))
        if (person_id, role) in crew_keys and "ﺗﻤﺜﻴﻞ" not in role and "تمثيل" not in role:
            continue
        role_credit = actor_credit(role)
        key = (person_id, "actor", role_credit)
        if key in seen:
            continue
        seen.add(key)
        yield {
            "person_id": person_id,
            "role_kind": "actor",
            "role_credit": role_credit,
            "billing_order": order,
        }

    for order, entry in enumerate(movie.get("crew", []), start=1):
        person_id = entry.get("person_id")
        if not person_id:
            continue
        role = clean_role(entry.get("role"))
        role_kind = map_role_kind(role)
        key = (person_id, role_kind, role)
        if key in seen:
            continue
        seen.add(key)
        yield {
            "person_id": person_id,
            "role_kind": role_kind,
            "role_credit": role,
            "billing_order": order,
        }


def write_chunk(chunks: list[str], output_dir: Path, index: int) -> None:
    path = output_dir / f"seed_{index:03d}.sql"
    path.write_text("\n".join(chunks) + "\n", encoding="utf-8")


def prepare(args: argparse.Namespace) -> dict[str, Any]:
    movies = load_json(args.movies)
    people = load_json(args.people)
    output_dir: Path = args.output
    output_dir.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(args.schema, output_dir / "schema.sql")

    genres = build_genres(movies)
    known_people = {person["id"]: person for person in people if person.get("id")}
    referenced_people: dict[str, dict[str, Any]] = dict(known_people)
    companies_by_id: dict[str, dict[str, Any]] = {}

    for movie in movies:
        for bucket in ("cast", "crew"):
            for entry in movie.get(bucket, []):
                person_id = entry.get("person_id")
                if person_id and person_id not in referenced_people:
                    referenced_people[person_id] = {
                        "id": person_id,
                        "name": entry.get("name") or person_id,
                        "image_url": entry.get("image_url") or "",
                    }
        for company in movie.get("companies", []):
            company_id = company.get("company_id") or company.get("id")
            if not company_id:
                continue
            companies_by_id[company_id] = {
                "id": company_id,
                "slug": company.get("slug") or company_id,
                "name_ar": company.get("name_ar") or company_id,
                "name_en": company.get("name_en") or None,
                "kind": company.get("kind") or company.get("role_kind") or None,
                "country": company.get("country") or "مصر",
                "description_ar": company.get("description_ar") or None,
            }

    chunks: list[str] = []
    chunk_index = 0
    chunk_bytes = 0
    counts = Counter()

    def add(statement: str) -> None:
        nonlocal chunk_index, chunk_bytes, chunks
        encoded_len = len(statement.encode("utf-8")) + 1
        if chunks and chunk_bytes + encoded_len > args.chunk_bytes:
            write_chunk(chunks, output_dir, chunk_index)
            chunk_index += 1
            chunks = []
            chunk_bytes = 0
        chunks.append(statement)
        chunk_bytes += encoded_len

    add("PRAGMA foreign_keys = OFF;")

    for genre_name, genre_id in genres.items():
        add(
            "INSERT INTO genres (id, slug, name_ar) VALUES "
            f"({genre_id}, {sql_value(f'genre-{genre_id:03d}')}, {sql_value(genre_name)});"
        )
        counts["genres"] += 1

    for person in sorted(referenced_people.values(), key=lambda item: item.get("id", "")):
        person_id = person.get("id")
        name = person.get("name_ar") or person.get("name") or person_id
        image_url = person.get("image_url") or person.get("profile_image") or None
        add(
            "INSERT INTO people (id, slug, name_ar, name_en, full_name, bio_ar, bio, birthdate, deathdate, country, profile_image) VALUES "
            f"({sql_value(person_id)}, {sql_value(person.get('slug') or person_id)}, {sql_value(name)}, "
            f"{sql_value(person.get('name_en'))}, {sql_value(person.get('full_name'))}, {sql_value(person.get('bio_ar'))}, "
            f"{sql_value(person.get('bio'))}, {sql_value(person.get('birthdate'))}, {sql_value(person.get('deathdate'))}, "
            f"{sql_value(person.get('country') or 'مصر')}, {sql_value(image_url)});"
        )
        counts["people"] += 1

        key = asset_key_from_url(image_url)
        if key:
            add(
                "INSERT INTO assets (person_id, kind, url, r2_key) VALUES "
                f"({sql_value(person_id)}, 'portrait', {sql_value(image_url)}, {sql_value(key)});"
            )
            counts["assets"] += 1

    for company in sorted(companies_by_id.values(), key=lambda item: item.get("id", "")):
        add(
            "INSERT INTO companies (id, slug, name_ar, name_en, kind, country, description_ar) VALUES "
            f"({sql_value(company.get('id'))}, {sql_value(company.get('slug'))}, {sql_value(company.get('name_ar'))}, "
            f"{sql_value(company.get('name_en'))}, {sql_value(company.get('kind'))}, {sql_value(company.get('country') or 'مصر')}, "
            f"{sql_value(company.get('description_ar'))});"
        )
        counts["companies"] += 1

    for movie in movies:
        movie_id = movie["id"]
        title = movie.get("title") or movie_id
        genre_text = ",".join(movie.get("genres", []))
        poster_url = movie.get("poster_url") or None
        add(
            "INSERT INTO movies (id, slug, title, title_ar, year, work_type, work_subtype, "
            "duration, duration_minutes, poster_url, genres, story, summary_ar, country, rating) VALUES "
            f"({sql_value(movie_id)}, {sql_value(movie_id)}, {sql_value(title)}, {sql_value(title)}, "
            f"{parse_year(movie.get('year'))}, {sql_value(movie.get('work_type') or 'فيلم')}, "
            f"{sql_value(movie.get('work_subtype'))}, {sql_value(movie.get('duration'))}, "
            f"{int(movie.get('duration_minutes') or 0) if movie.get('duration_minutes') else 'NULL'}, "
            f"{sql_value(poster_url)}, {sql_value(genre_text)}, "
            f"{sql_value(movie.get('story'))}, {sql_value(movie.get('story'))}, "
            f"{sql_value(movie.get('country') or 'مصر')}, {float(movie.get('rating') or 0)});"
        )
        counts["movies"] += 1

        poster_key = asset_key_from_url(poster_url)
        if poster_key:
            add(
                "INSERT INTO assets (movie_id, kind, url, r2_key) VALUES "
                f"({sql_value(movie_id)}, 'poster', {sql_value(poster_url)}, {sql_value(poster_key)});"
            )
            counts["assets"] += 1

        for genre in movie.get("genres", []):
            genre_id = genres.get(genre)
            if genre_id:
                add(
                    "INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES "
                    f"({sql_value(movie_id)}, {genre_id});"
                )
                counts["movie_genres"] += 1

        cast_names: list[str] = []
        crew_names: list[str] = []
        for credit in iter_movie_people(movie):
            person = referenced_people.get(credit["person_id"], {})
            name = person.get("name") or person.get("name_ar") or credit["person_id"]
            if credit["role_kind"] == "actor":
                cast_names.append(name)
            else:
                crew_names.append(name)
            add(
                "INSERT OR IGNORE INTO movie_people "
                "(movie_id, person_id, role_kind, role_credit, billing_order) VALUES "
                f"({sql_value(movie_id)}, {sql_value(credit['person_id'])}, "
                f"{sql_value(credit['role_kind'])}, {sql_value(credit['role_credit'])}, "
                f"{int(credit['billing_order'])});"
            )
            counts["movie_people"] += 1

        for company in movie.get("companies", []):
            company_id = company.get("company_id") or company.get("id")
            if not company_id:
                continue
            add(
                "INSERT OR IGNORE INTO movie_companies (movie_id, company_id, role_kind) VALUES "
                f"({sql_value(movie_id)}, {sql_value(company_id)}, {sql_value(company.get('role_kind') or company.get('kind') or 'company')});"
            )
            counts["movie_companies"] += 1

        for link in movie.get("watch_links", []):
            if not isinstance(link, dict) or not link.get("url"):
                continue
            add(
                "INSERT INTO watch_links "
                "(movie_id, provider_key, platform, url, embed_url, embed_type, source_kind, title, confidence, verified_at, is_official) VALUES "
                f"({sql_value(movie_id)}, {sql_value(link.get('provider_key'))}, {sql_value(link.get('platform'))}, "
                f"{sql_value(link.get('url'))}, {sql_value(link.get('embed_url'))}, {sql_value(link.get('embed_type') or 'external')}, "
                f"{sql_value(link.get('source_kind') or 'manual')}, {sql_value(link.get('title'))}, "
                f"{sql_value(link.get('confidence'))}, {sql_value(link.get('verified_at'))}, {int(link.get('is_official') or 0)});"
            )
            counts["watch_links"] += 1

        for category_key, category_name in (("news", "news"), ("reviews", "review")):
            for item in movie.get(category_key, []):
                if not isinstance(item, dict) or not item.get("link"):
                    continue
                add(
                    "INSERT INTO news "
                    "(entity_type, entity_id, category, title, link, domain, snippet, published_at) VALUES "
                    f"('movie', {sql_value(movie_id)}, {sql_value(item.get('category') or category_name)}, "
                    f"{sql_value(item.get('title'))}, {sql_value(item.get('link'))}, {sql_value(item.get('domain'))}, "
                    f"{sql_value(item.get('snippet'))}, {sql_value(item.get('published_at'))});"
                )
                counts["news"] += 1

        add(
            "INSERT INTO movie_search "
            "(movie_id, title, title_ar, title_en, summary_ar, story, genres, cast_names, crew_names) VALUES "
            f"({sql_value(movie_id)}, {sql_value(title)}, {sql_value(title)}, {sql_value(movie.get('title_en'))}, "
            f"{sql_value(movie.get('story'))}, {sql_value(movie.get('story'))}, {sql_value(genre_text)}, "
            f"{sql_value(' '.join(cast_names))}, {sql_value(' '.join(crew_names))});"
        )
        counts["movie_search"] += 1

    add("PRAGMA foreign_keys = ON;")

    if chunks:
        write_chunk(chunks, output_dir, chunk_index)

    summary = {
        "movies_source": str(args.movies.relative_to(ROOT) if args.movies.is_relative_to(ROOT) else args.movies),
        "people_source": str(args.people.relative_to(ROOT) if args.people.is_relative_to(ROOT) else args.people),
        "schema": str(args.schema.relative_to(ROOT) if args.schema.is_relative_to(ROOT) else args.schema),
        "output_dir": str(output_dir.relative_to(ROOT) if output_dir.is_relative_to(ROOT) else output_dir),
        "chunk_bytes": args.chunk_bytes,
        "files": ["schema.sql"] + [f"seed_{i:03d}.sql" for i in range(chunk_index + 1)],
        "counts": dict(counts),
    }
    (output_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return summary


def validate_sqlite(output_dir: Path, db_path: Path) -> dict[str, int]:
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript((output_dir / "schema.sql").read_text(encoding="utf-8"))
        for seed_path in sorted(output_dir.glob("seed_*.sql")):
            conn.executescript(seed_path.read_text(encoding="utf-8"))
        tables = ["movies", "people", "companies", "genres", "movie_genres", "movie_people", "movie_companies", "assets", "watch_links", "news", "movie_search"]
        counts = {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in tables
        }
        forbidden = {}
        for word in ("elcinema", "dhliz"):
            forbidden[word] = conn.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM movies WHERE poster_url LIKE ? OR story LIKE ? OR genres LIKE ?)
                + (SELECT COUNT(*) FROM people WHERE profile_image LIKE ?)
                + (SELECT COUNT(*) FROM assets WHERE url LIKE ? OR r2_key LIKE ?)
                """,
                tuple([f"%{word}%"] * 6),
            ).fetchone()[0]
        counts.update({f"forbidden_{key}": value for key, value in forbidden.items()})
        return counts
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare clean ElFilm public D1 schema and seed SQL.")
    parser.add_argument("--movies", type=Path, default=DEFAULT_MOVIES)
    parser.add_argument("--people", type=Path, default=DEFAULT_PEOPLE)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--chunk-bytes", type=int, default=3_500_000)
    parser.add_argument("--validate-db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--skip-validate", action="store_true")
    args = parser.parse_args()

    args.movies = args.movies.resolve()
    args.people = args.people.resolve()
    args.schema = args.schema.resolve()
    args.output = args.output.resolve()
    args.validate_db = args.validate_db.resolve()

    summary = prepare(args)
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if not args.skip_validate:
        validation = validate_sqlite(args.output, args.validate_db)
        print("Validation:")
        print(json.dumps(validation, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
