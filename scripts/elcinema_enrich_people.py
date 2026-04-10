#!/usr/bin/env python3
"""
Enrich cast/crew people records from public ElCinema person pages.

This produces a compact sidecar JSON keyed by the original ElCinema person ID.
It is designed to feed `build_public_elfilm_dataset.py --people-enrichment ...`
so the public dataset can expose richer actor/director/writer profiles without
shipping private source URLs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup


USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
COMPANY_ROLE_TOKENS = ("شركة", "إنتاج", "انتاج", "توزيع", "استوديو", "ستوديو")
COMPANY_NAME_TOKENS = (
    "شركة",
    "للإنتاج",
    "للانتاج",
    "لإنتاج",
    "لانتاج",
    "للتوزيع",
    "للتوزيع",
    "للاستثمار",
    "للاتصالات",
    "للأفلام",
    "للافلام",
    "السينمائيين",
    "السينما",
    "استوديو",
    "ستوديو",
    "مؤسسة",
    "مؤسسه",
    "مجموعة",
    "جروب",
    "قناة",
    "شبكة",
    "فيلم",
    "افلام",
    "films",
    "film",
    "movies",
    "movie",
    "media",
    "entertainment",
    "production",
    "productions",
    "pictures",
    "distribution",
    "laboratory",
    "laboratories",
    "cinema",
    "studio",
)
LATIN_RE = re.compile(r"[A-Za-z]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich people from ElCinema person pages.")
    parser.add_argument("--input", default="elcinema_egyptian_movies_full.json")
    parser.add_argument("--output", default="elcinema_people_enrichment.json")
    parser.add_argument("--max-people", type=int, default=25)
    parser.add_argument("--person-id", action="append", default=[], help="Restrict to one or more person IDs.")
    parser.add_argument("--query-delay-seconds", type=float, default=0.35)
    parser.add_argument("--refresh-existing", action="store_true")
    return parser.parse_args()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
    os.replace(temp_path, path)


def normalize_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def looks_like_company_credit(person: dict[str, Any]) -> bool:
    role = normalize_space(person.get("role"))
    name_raw = normalize_space(person.get("name"))
    name = name_raw.lower()
    normalized_name = re.sub(r"\s+", " ", name_raw).strip()
    if any(token in role for token in COMPANY_ROLE_TOKENS):
        return True
    if any(token in name for token in COMPANY_NAME_TOKENS):
        return True
    if normalized_name.startswith("أفلام ") or normalized_name.startswith("افلام "):
        return True
    if normalized_name.endswith(" فيلم") or normalized_name.endswith(" افلام"):
        return True
    if "السينمائيين" in normalized_name or "اتحاد" in normalized_name and "فنان" not in normalized_name:
        return True
    if len(name.split()) > 1 and any(token in name for token in ("film", "films", "studio", "media", "production", "productions", "distribution", "entertainment", "pictures", "network", "channel")):
        return True
    return False


def unique_people_from_movies(movies: list[dict[str, Any]]) -> list[dict[str, Any]]:
    people_by_id: dict[str, dict[str, Any]] = {}
    for movie in movies:
        for group in ("cast", "crew"):
            for person in movie.get(group) or []:
                if not isinstance(person, dict):
                    continue
                person_id = str(person.get("id") or "").strip()
                if not person_id or looks_like_company_credit(person):
                    continue
                current = people_by_id.setdefault(
                    person_id,
                    {
                        "person_id": person_id,
                        "name_ar": normalize_space(person.get("name")),
                        "roles": set(),
                    },
                )
                role = normalize_space(person.get("role"))
                if role:
                    current["roles"].add(role)
    records: list[dict[str, Any]] = []
    for item in people_by_id.values():
        item["roles"] = sorted(item["roles"])
        records.append(item)
    records.sort(key=lambda item: item["person_id"])
    return records


def fetch_html(url: str, retries: int = 2) -> str:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read().decode("utf-8", errors="ignore")
        except Exception as error:
            last_error = error
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error))


def extract_name_en(strings: list[str]) -> str:
    for index, token in enumerate(strings):
        if token == "English":
            for candidate in strings[index + 1:index + 5]:
                if LATIN_RE.search(candidate):
                    return candidate.strip()
    return ""


def extract_bio(strings: list[str]) -> str:
    if "السيرة الذاتية" not in strings:
        return ""
    start = strings.index("السيرة الذاتية") + 1
    stop_markers = {"الموطن:", "بلد الميلاد:", "تاريخ الميلاد:", "تاريخ الوفاة:"}
    parts: list[str] = []
    for token in strings[start:]:
        if token in stop_markers:
            break
        if token.startswith("صفحة ") or token == "...اقرأ المزيد":
            continue
        if token in {"English"}:
            continue
        parts.append(token)
    bio = " ".join(parts)
    return normalize_space(bio)


def extract_detail_pairs(soup: BeautifulSoup) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for ul in soup.select("ul.list-separator.list-title"):
        items = [li.get_text(" ", strip=True) for li in ul.find_all("li", recursive=False)]
        if len(items) >= 2:
            pairs[items[0]] = normalize_space(items[1])
    return pairs


def parse_birthdate(raw_value: str) -> str:
    text = normalize_space(raw_value)
    year_match = re.search(r"(19|20)\d{2}", text)
    if not year_match:
        return ""
    return text


def enrich_person(person: dict[str, Any]) -> dict[str, Any]:
    person_id = person["person_id"]
    url = f"https://elcinema.com/person/{person_id}/"
    html = fetch_html(url)
    soup = BeautifulSoup(html, "html.parser")
    strings = list(soup.stripped_strings)
    detail_pairs = extract_detail_pairs(soup)

    og_image = soup.find("meta", property="og:image")
    country = detail_pairs.get("الموطن:") or detail_pairs.get("بلد الميلاد:") or "مصر"

    return {
        "person_id": person_id,
        "name_ar": person.get("name_ar") or "",
        "name_en": extract_name_en(strings),
        "full_name": person.get("name_ar") or "",
        "bio": extract_bio(strings),
        "bio_ar": extract_bio(strings),
        "birthdate": parse_birthdate(detail_pairs.get("تاريخ الميلاد:", "")),
        "deathdate": parse_birthdate(detail_pairs.get("تاريخ الوفاة:", "")),
        "country": country,
        "profile_image": og_image.get("content") if og_image else "",
        "roles": person.get("roles") or [],
    }


def existing_enrichment_map(path: Path) -> dict[str, dict[str, Any]]:
    records = load_json(path, [])
    if isinstance(records, dict):
        return {str(key): value for key, value in records.items() if isinstance(value, dict)}
    if not isinstance(records, list):
        return {}
    return {
        str(item.get("person_id")): item
        for item in records
        if isinstance(item, dict) and item.get("person_id")
    }


def main() -> int:
    args = parse_args()
    movies = load_json(Path(args.input), [])
    if not isinstance(movies, list):
        raise ValueError("Input JSON must contain a list of movies")

    output_path = Path(args.output)
    existing = existing_enrichment_map(output_path)
    people = unique_people_from_movies(movies)
    selected_ids = set(args.person_id)
    processed = 0

    for person in people:
        person_id = person["person_id"]
        if selected_ids and person_id not in selected_ids:
            continue
        if person_id in existing and not args.refresh_existing:
            continue
        if processed >= args.max_people:
            break
        print(f"[{processed + 1}/{args.max_people}] Enriching {person.get('name_ar') or person_id}")
        try:
            existing[person_id] = enrich_person(person)
        except Exception as error:
            print(f"Failed {person_id}: {error}")
        ordered_records = sorted(existing.values(), key=lambda item: str(item.get("person_id") or ""))
        save_json_atomic(output_path, ordered_records)
        processed += 1
        time.sleep(args.query_delay_seconds)

    print(f"Saved {len(existing)} people enrichment records to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
