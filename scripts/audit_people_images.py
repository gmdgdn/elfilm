#!/usr/bin/env python3
"""
Audit person-image consistency across source credits, person-page enrichments,
and the current public dataset.

This script produces:
  - a JSON summary plus review queue
  - a short Markdown report for quick inspection

It is designed to answer three practical questions:
  1. Which people have conflicting image candidates?
  2. Which public records disagree with the enriched person page?
  3. Which records still cannot be verified automatically?
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


DEFAULT_INPUT = Path("elcinema_egyptian_movies_full.json")
DEFAULT_PUBLIC_PEOPLE = Path("public_data/elfilm_people_public.json")
DEFAULT_PERSON_MAPPING = Path("id_mappings/person_id_mapping_private.json")
DEFAULT_OUTPUT = Path("public_data/people_image_audit.json")
DEFAULT_REPORT = Path("public_data/people_image_audit.md")
DEFAULT_ENRICHMENT_GLOB = "elcinema_people_enrichment*.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit person-image consistency in ElFilm data.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument(
        "--people-enrichment",
        action="append",
        default=[],
        help="Optional enrichment JSON file(s). Defaults to all elcinema_people_enrichment*.json files.",
    )
    parser.add_argument("--public-people", type=Path, default=DEFAULT_PUBLIC_PEOPLE)
    parser.add_argument("--person-mapping", type=Path, default=DEFAULT_PERSON_MAPPING)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument(
        "--include-unverified",
        action="store_true",
        help="Include credit-only records in the review queue.",
    )
    return parser.parse_args()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def is_blank_image(url: str) -> bool:
    url = str(url or "").strip()
    return not url or "blank_photos" in url or "no-pic" in url


def normalize_image_key(url: str) -> str:
    url = str(url or "").strip()
    if is_blank_image(url):
        return ""
    filename = url.split("?", 1)[0].rsplit("/", 1)[-1]
    return re.sub(r"^_[0-9]+x[0-9]*_", "", filename)


def resolve_enrichment_paths(raw_paths: list[str]) -> list[Path]:
    if raw_paths:
        return [Path(path) for path in raw_paths]
    return sorted(Path(".").glob(DEFAULT_ENRICHMENT_GLOB))


def load_people_enrichment_map(paths: list[Path]) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for path in paths:
        payload = load_json(path, [])
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            records = payload.values()
        else:
            continue
        for item in records:
            if not isinstance(item, dict):
                continue
            person_id = str(item.get("person_id") or item.get("id") or "").strip()
            if person_id:
                merged[person_id] = item
    return merged


def collect_people_from_movies(movies: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    people: dict[str, dict[str, Any]] = {}
    for movie in movies:
        movie_title = normalize_space(movie.get("title"))
        for group in ("cast", "crew"):
            for person in movie.get(group) or []:
                if not isinstance(person, dict):
                    continue
                person_id = str(person.get("id") or "").strip()
                if not person_id:
                    continue
                record = people.setdefault(
                    person_id,
                    {
                        "person_id": person_id,
                        "name": normalize_space(person.get("name")),
                        "credit_image_urls": set(),
                        "sample_movies": [],
                        "roles": set(),
                        "occurrences": 0,
                    },
                )
                record["occurrences"] += 1
                role = normalize_space(person.get("role"))
                if role:
                    record["roles"].add(role)
                image_url = normalize_space(person.get("image_url"))
                if image_url:
                    record["credit_image_urls"].add(image_url)
                if movie_title and movie_title not in record["sample_movies"] and len(record["sample_movies"]) < 5:
                    record["sample_movies"].append(movie_title)

    normalized: dict[str, dict[str, Any]] = {}
    for person_id, item in people.items():
        normalized[person_id] = {
            **item,
            "credit_image_urls": sorted(item["credit_image_urls"]),
            "roles": sorted(item["roles"]),
        }
    return normalized


def load_public_people_map(public_people_path: Path) -> dict[str, dict[str, Any]]:
    people = load_json(public_people_path, [])
    if not isinstance(people, list):
        return {}
    return {
        str(item.get("id") or "").strip(): item
        for item in people
        if isinstance(item, dict) and str(item.get("id") or "").strip()
    }


def load_person_mapping(path: Path) -> dict[str, dict[str, Any]]:
    payload = load_json(path, {})
    if not isinstance(payload, dict):
        return {}
    mapping: dict[str, dict[str, Any]] = {}
    for item in payload.values():
        if not isinstance(item, dict):
            continue
        old_id = str(item.get("old_id") or "").strip()
        if old_id:
            mapping[old_id] = item
    return mapping


def recommended_action(flags: list[str], profile_key: str, public_key: str) -> str:
    if "published_source_conflicts_with_profile" in flags:
        return "Rebuild public people data from the enriched profile image and re-download the portrait."
    if "profile_conflicts_with_credit" in flags:
        return "Use the person-page profile image as canonical and manually spot-check the source page."
    if "multiple_credit_images" in flags and profile_key:
        return "Keep the profile image and mark credit thumbnails as inconsistent source data."
    if "multiple_credit_images" in flags:
        return "Manually review because different credit cards point to different portraits."
    if "published_source_missing_but_profile_available" in flags:
        return "Rebuild public data so the verified profile image is published."
    if not public_key and profile_key:
        return "Publish the enriched profile image."
    return "No action needed."


def build_audit_rows(
    people_from_movies: dict[str, dict[str, Any]],
    enrichment_map: dict[str, dict[str, Any]],
    public_people_map: dict[str, dict[str, Any]],
    person_mapping: dict[str, dict[str, Any]],
    include_unverified: bool,
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    counters = Counter()
    review_queue: list[dict[str, Any]] = []

    for person_id, person in sorted(people_from_movies.items()):
        counters["total_people"] += 1

        credit_urls = person["credit_image_urls"]
        nonblank_credit_urls = [url for url in credit_urls if not is_blank_image(url)]
        credit_keys = sorted({normalize_image_key(url) for url in nonblank_credit_urls if normalize_image_key(url)})
        if credit_keys:
            counters["people_with_nonblank_credit_image"] += 1
        if len(credit_keys) > 1:
            counters["people_with_multiple_credit_images"] += 1

        enrichment = enrichment_map.get(person_id, {})
        profile_image_url = normalize_space(enrichment.get("profile_image"))
        profile_key = normalize_image_key(profile_image_url)
        if enrichment:
            counters["enriched_people"] += 1
        if profile_key:
            counters["people_with_nonblank_profile_image"] += 1

        mapping_record = person_mapping.get(person_id, {})
        public_id = str(mapping_record.get("public_id") or "").strip()
        public_record = public_people_map.get(public_id, {}) if public_id else {}
        public_image_url = normalize_space(public_record.get("image_url"))
        current_source_image_url = normalize_space(mapping_record.get("source_image_url"))
        current_source_key = normalize_image_key(current_source_image_url)
        if public_record:
            counters["people_with_public_record"] += 1

        flags: list[str] = []
        verification_status = "unverified"
        public_status = "not_published"

        if len(credit_keys) > 1:
            flags.append("multiple_credit_images")

        primary_credit_key = credit_keys[0] if len(credit_keys) == 1 else ""
        primary_credit_url = nonblank_credit_urls[0] if len(nonblank_credit_urls) == 1 else ""

        if profile_key and primary_credit_key:
            if profile_key == primary_credit_key:
                verification_status = "profile_matches_credit"
                counters["profile_matches_credit"] += 1
            else:
                verification_status = "profile_conflicts_with_credit"
                counters["profile_conflicts_with_credit"] += 1
                flags.append("profile_conflicts_with_credit")
        elif profile_key:
            verification_status = "profile_only"
            counters["profile_only"] += 1
        elif primary_credit_key:
            verification_status = "credit_only"
            counters["credit_only"] += 1
        else:
            verification_status = "no_nonblank_image"
            counters["no_nonblank_image"] += 1

        if current_source_key and profile_key:
            if current_source_key == profile_key:
                public_status = "published_source_matches_profile"
                counters["published_source_matches_profile"] += 1
            else:
                public_status = "published_source_conflicts_with_profile"
                counters["published_source_conflicts_with_profile"] += 1
                flags.append("published_source_conflicts_with_profile")
        elif current_source_key and primary_credit_key:
            if current_source_key == primary_credit_key:
                public_status = "published_source_matches_credit"
                counters["published_source_matches_credit"] += 1
            else:
                public_status = "published_source_unverified"
                counters["published_source_unverified"] += 1
        elif not current_source_key and profile_key:
            public_status = "published_source_missing_but_profile_available"
            counters["published_source_missing_but_profile_available"] += 1
            flags.append("published_source_missing_but_profile_available")
        elif not current_source_key and primary_credit_key:
            public_status = "published_source_missing_but_credit_available"
            counters["published_source_missing_but_credit_available"] += 1
        else:
            public_status = "published_source_missing"
            counters["published_source_missing"] += 1

        should_include = bool(flags)
        if include_unverified and verification_status == "credit_only":
            should_include = True

        if not should_include:
            continue

        review_queue.append(
            {
                "person_id": person_id,
                "public_id": public_id,
                "name": person["name"],
                "verification_status": verification_status,
                "public_status": public_status,
                "flags": flags,
                "recommended_action": recommended_action(flags, profile_key, current_source_key),
                "credit_image_urls": credit_urls,
                "profile_image_url": profile_image_url,
                "current_source_image_url": current_source_image_url,
                "public_image_url": public_image_url,
                "roles": person["roles"],
                "sample_movies": person["sample_movies"],
                "occurrences": person["occurrences"],
            }
        )

    review_queue.sort(
        key=lambda item: (
            "published_source_conflicts_with_profile" not in item["flags"],
            "profile_conflicts_with_credit" not in item["flags"],
            "multiple_credit_images" not in item["flags"],
            item["name"],
            item["person_id"],
        )
    )
    return dict(counters), review_queue


def write_report(path: Path, summary: dict[str, int], review_queue: list[dict[str, Any]]) -> None:
    lines = [
        "# People Image Audit",
        "",
        f"- Total people scanned: {summary.get('total_people', 0)}",
        f"- Enriched people available: {summary.get('enriched_people', 0)}",
        f"- People with public records: {summary.get('people_with_public_record', 0)}",
        f"- Nonblank credit images: {summary.get('people_with_nonblank_credit_image', 0)}",
        f"- Nonblank profile images: {summary.get('people_with_nonblank_profile_image', 0)}",
        f"- Profile matches credit: {summary.get('profile_matches_credit', 0)}",
        f"- Profile conflicts with credit: {summary.get('profile_conflicts_with_credit', 0)}",
        f"- Multiple credit-image variants: {summary.get('people_with_multiple_credit_images', 0)}",
        f"- Published source matches profile: {summary.get('published_source_matches_profile', 0)}",
        f"- Published source conflicts with profile: {summary.get('published_source_conflicts_with_profile', 0)}",
        f"- Published source missing but profile available: {summary.get('published_source_missing_but_profile_available', 0)}",
        "",
        "## Review Queue",
        "",
        f"- Flagged records: {len(review_queue)}",
    ]

    for item in review_queue[:20]:
        flags = ", ".join(item["flags"]) or "none"
        lines.extend(
            [
                "",
                f"### {item['name'] or item['person_id']}",
                f"- Original person ID: {item['person_id']}",
                f"- Public person ID: {item['public_id'] or 'not mapped'}",
                f"- Verification status: {item['verification_status']}",
                f"- Public status: {item['public_status']}",
                f"- Flags: {flags}",
                f"- Recommended action: {item['recommended_action']}",
            ]
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()

    movies = load_json(args.input, [])
    if not isinstance(movies, list):
        raise ValueError("Input JSON must contain a list of movies")

    enrichment_paths = resolve_enrichment_paths(args.people_enrichment)
    enrichment_map = load_people_enrichment_map(enrichment_paths)
    people_from_movies = collect_people_from_movies(movies)
    public_people_map = load_public_people_map(args.public_people)
    person_mapping = load_person_mapping(args.person_mapping)

    summary, review_queue = build_audit_rows(
        people_from_movies,
        enrichment_map,
        public_people_map,
        person_mapping,
        args.include_unverified,
    )

    payload = {
        "input": str(args.input),
        "people_enrichment_files": [str(path) for path in enrichment_paths],
        "public_people": str(args.public_people),
        "person_mapping": str(args.person_mapping),
        "summary": summary,
        "review_queue": review_queue,
    }
    save_json(args.output, payload)
    write_report(args.report, summary, review_queue)

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Flagged records: {len(review_queue)}")
    print(f"JSON report: {args.output}")
    print(f"Markdown report: {args.report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
