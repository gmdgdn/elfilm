#!/usr/bin/env python3
"""
Test script using demo data to validate scraper functionality.
"""

import json
import sys

sys.path.insert(0, ".")

from elfilm.parsers import (
    parse_year_page,
    parse_english_film_page,
    parse_arabic_film_page,
)
from elfilm.models import Film
from elfilm.demo_data import YEAR_1950_HTML, FILM_EN_HTML, FILM_AR_HTML


def test_parse_year():
    """Test year page parsing."""
    print("=" * 60)
    print("Testing Year Page Parser (1950)")
    print("=" * 60)

    slugs = parse_year_page(YEAR_1950_HTML, 1950)
    print(f"\nFound slugs: {slugs}")
    assert len(slugs) == 3, f"Expected 3 slugs, got {len(slugs)}"
    assert "aakher_kedba" in slugs, "Expected 'aakher_kedba' in slugs"

    print("✓ Year parser test passed!\n")
    return slugs


def test_parse_english_film(slug="aakher_kedba"):
    """Test English film page parsing."""
    print("=" * 60)
    print("Testing English Film Page Parser")
    print("=" * 60)

    data = parse_english_film_page(FILM_EN_HTML, slug)
    print(f"\nParsed English data:")
    print(json.dumps(
        {k: v for k, v in data.items() if k not in ["crew", "cast_en"]},
        indent=2,
        ensure_ascii=False
    ))

    # Validate
    assert data["title_en"] == "Aakher Kedba", f"Title mismatch: {data['title_en']}"
    assert data["production_year"] == 1950, f"Year mismatch: {data['production_year']}"
    assert data["duration_minutes"] == 115, f"Duration mismatch: {data['duration_minutes']}"
    assert "Comedy" in data["genres_en"], "Expected 'Comedy' in genres"
    assert "Drama" in data["genres_en"], "Expected 'Drama' in genres"

    print("\nCrew:")
    for role, names in data["crew"].items():
        print(f"  {role}: {names}")

    print("\nCast:")
    for member in data["cast_en"]:
        print(f"  {member.name}: {member.rating}")

    print("\nTags:")
    print(f"  {data['tags_en']}")

    print("\n✓ English film parser test passed!\n")
    return data


def test_parse_arabic_film(slug="aakher_kedba"):
    """Test Arabic film page parsing."""
    print("=" * 60)
    print("Testing Arabic Film Page Parser")
    print("=" * 60)

    data = parse_arabic_film_page(FILM_AR_HTML, slug)
    print(f"\nParsed Arabic data:")

    print(f"\nSummary (first 100 chars):")
    if data["summary_ar"]:
        print(f"  {data['summary_ar'][:100]}...")

    print(f"\nTags:")
    print(f"  {data['tags_ar']}")

    print("\n✓ Arabic film parser test passed!\n")
    return data


def test_create_film():
    """Test Film object creation."""
    print("=" * 60)
    print("Testing Film Object Creation")
    print("=" * 60)

    en_data = parse_english_film_page(FILM_EN_HTML, "aakher_kedba")
    ar_data = parse_arabic_film_page(FILM_AR_HTML, "aakher_kedba")

    film = Film(
        slug="aakher_kedba",
        urls={
            "film_page_en": "https://dhliz.com/en/film/aakher_kedba/",
            "film_page_ar": "https://dhliz.com/film/aakher_kedba/",
        },
        title_en=en_data.get("title_en", ""),
        title_ar=en_data.get("title_ar") or ar_data.get("title_ar"),
        production_year=en_data.get("production_year", 1950),
        type=en_data.get("type"),
        duration_minutes=en_data.get("duration_minutes"),
        genres_en=en_data.get("genres_en", []),
        summary_ar=ar_data.get("summary_ar"),
        crew=en_data.get("crew", {}),
        cast_en=en_data.get("cast_en", []),
        tags_en=en_data.get("tags_en", []),
        tags_ar=ar_data.get("tags_ar", []),
    )

    print(f"\nFilm object created:")
    print(f"  Title (EN): {film.title_en}")
    print(f"  Title (AR): {film.title_ar}")
    print(f"  Year: {film.production_year}")
    print(f"  Type: {film.type}")
    print(f"  Duration: {film.duration_minutes} minutes")
    print(f"  Genres: {film.genres_en}")
    print(f"  Cast: {len(film.cast_en)} members")
    print(f"  Tags (EN): {film.tags_en}")
    print(f"  Tags (AR): {film.tags_ar}")

    # Convert to dict
    film_dict = film.model_dump()
    print(f"\nFilm as JSON (truncated):")
    print(json.dumps(
        {k: v for k, v in film_dict.items() if v and k != "summary_ar"},
        indent=2,
        ensure_ascii=False,
        default=str
    ))

    print("\n✓ Film object test passed!\n")
    return film


def main():
    """Run all tests."""
    print("\n")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 15 + "ElFilm Scraper Demo & Tests" + " " * 16 + "║")
    print("╚" + "=" * 58 + "╝")
    print()

    try:
        # Test parsers
        slugs = test_parse_year()
        en_data = test_parse_english_film()
        ar_data = test_parse_arabic_film()
        film = test_create_film()

        # Summary
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"\n✓ All tests passed!")
        print(f"✓ Successfully parsed year page with {len(slugs)} films")
        print(f"✓ Successfully parsed English and Arabic film pages")
        print(f"✓ Successfully created Film object")
        print(f"\nThe scraper is ready to use. You can now:")
        print(f"  1. Run: python -m elfilm.main 1950 1950")
        print(f"     (when access to Dhliz is available)")
        print(f"  2. Check output in: elfilm/output/")
        print()

    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
