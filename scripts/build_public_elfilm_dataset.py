"""
Build source-free public ElFilm data and download referenced images.

Input:
  elcinema_egyptian_movies_full.json

Public outputs:
  public_data/elfilm_movies_public.json
  public_data/elfilm_people_public.json
  public_data/elfilm_movie_people_edges.json
  public_data/migration_report.md

Private maintenance outputs:
  id_mappings/movie_id_mapping_private.json
  id_mappings/person_id_mapping_private.json
  id_mappings/image_mapping_private.json

Images are downloaded to:
  public/assets/elfilm/posters
  public/assets/elfilm/people

Public image URLs are rewritten to:
  https://elfilm.net/assets/elfilm/...
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


FORBIDDEN_PUBLIC_STRINGS = ("elcinema", "dhliz")
IMAGE_TIMEOUT_SECONDS = 30
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build source-free ElFilm public JSON and local image assets.")
    parser.add_argument("--input", default="elcinema_egyptian_movies_full.json")
    parser.add_argument("--enrichment", action="append", default=[], help="Optional sidecar enrichment JSON file(s).")
    parser.add_argument("--people-enrichment", action="append", default=[], help="Optional person enrichment JSON file(s).")
    parser.add_argument("--public-output-dir", default="public_data")
    parser.add_argument("--private-mapping-dir", default="id_mappings")
    parser.add_argument("--asset-dir", default="public/assets/elfilm")
    parser.add_argument("--public-asset-base-url", default="https://film.gmd.gdn/assets/elfilm")
    parser.add_argument("--concurrency", type=int, default=12)
    parser.add_argument("--no-download-images", action="store_true")
    return parser.parse_args()


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_enrichment_map(paths: list[str]) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for raw_path in paths:
        path = Path(raw_path)
        payload = load_json(path, [])
        if isinstance(payload, dict):
            records = payload.values()
        elif isinstance(payload, list):
            records = payload
        else:
            continue
        for item in records:
            if not isinstance(item, dict):
                continue
            movie_id = str(item.get("movie_id") or "").strip()
            if movie_id:
                merged[movie_id] = item
    return merged


def load_people_enrichment_map(paths: list[str]) -> dict[str, dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for raw_path in paths:
        path = Path(raw_path)
        payload = load_json(path, [])
        if isinstance(payload, dict):
            records = payload.values()
        elif isinstance(payload, list):
            records = payload
        else:
            continue
        for item in records:
            if not isinstance(item, dict):
                continue
            person_id = str(item.get("person_id") or item.get("id") or item.get("old_id") or "").strip()
            if person_id:
                merged[person_id] = item
    return merged


def save_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, path)


def parse_year(value: Any) -> int | None:
    try:
        year = int(str(value).strip())
    except Exception:
        return None
    if 1800 <= year <= 2100:
        return year
    return None


def normalize_title(title: Any) -> str:
    text = str(title or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def movie_sort_key(movie: dict[str, Any]) -> tuple[Any, ...]:
    year = parse_year(movie.get("year"))
    return (
        year is None,
        year if year is not None else 9999,
        normalize_title(movie.get("title")),
        str(movie.get("id") or ""),
    )


def new_movie_id(index: int) -> str:
    return f"EF-M-{index:06d}"


def new_person_id(index: int) -> str:
    return f"EF-P-{index:06d}"


def new_company_id(index: int) -> str:
    return f"EF-C-{index:06d}"


def person_key(person: dict[str, Any]) -> str:
    raw_id = str(person.get("id") or "").strip()
    if raw_id:
        return raw_id
    name = normalize_title(person.get("name"))
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]
    return f"name:{digest}"


def is_forbidden_public_link(url: str) -> bool:
    lowered = url.lower()
    return any(term in lowered for term in FORBIDDEN_PUBLIC_STRINGS)


def dedupe_items(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        value = str(item.get(key) or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(item)
    return deduped


def sanitize_watch_links(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if not url or is_forbidden_public_link(url):
            continue
        embed_url = str(item.get("embed_url") or "").strip()
        if embed_url and is_forbidden_public_link(embed_url):
            embed_url = ""
        sanitized.append(
            {
                "provider_key": str(item.get("provider_key") or "").strip(),
                "platform": str(item.get("platform") or item.get("provider_key") or "Watch").strip(),
                "url": url,
                "title": str(item.get("title") or "").strip(),
                "embed_url": embed_url,
                "embed_type": str(item.get("embed_type") or "external").strip(),
                "source_kind": str(item.get("source_kind") or "manual").strip(),
                "confidence": item.get("confidence") or 0,
                "is_official": int(item.get("is_official") or 0),
                "verified_at": str(item.get("verified_at") or "").strip(),
            }
        )
    return dedupe_items(sanitized, "url")


def sanitize_articles(items: list[dict[str, Any]], category: str) -> list[dict[str, Any]]:
    sanitized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        link = str(item.get("link") or item.get("url") or "").strip()
        if not link or is_forbidden_public_link(link):
            continue
        sanitized.append(
            {
                "category": str(item.get("category") or category).strip() or category,
                "title": str(item.get("title") or "").strip(),
                "link": link,
                "snippet": str(item.get("snippet") or "").strip(),
                "domain": str(item.get("domain") or urllib.parse.urlparse(link).netloc.replace("www.", "")).strip(),
                "published_at": str(item.get("published_at") or "").strip(),
            }
        )
    return dedupe_items(sanitized, "link")


COMPANY_NAME_HINTS = (
    "شركة",
    "للإنتاج",
    "للانتاج",
    "لإنتاج",
    "لانتاج",
    "للإعلان",
    "للإعلام",
    "للأفلام",
    "للاستثمار",
    "للاتصالات",
    "السينمائيين",
    "السينما",
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
    "studio",
    "ستوديو",
    "استوديو",
    "سينما",
    "channel",
    "network",
    "group",
    "corporation",
    "company",
    "institution",
    "مؤسسة",
    "مؤسسه",
    "مجموعة",
    "جروب",
    "قناة",
    "شبكة",
    "فيلم",
    "افلام",
)


def normalize_space(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def company_key(entry: dict[str, Any]) -> str:
    raw_id = str(entry.get("id") or "").strip()
    if raw_id:
        return raw_id
    name = normalize_space(entry.get("name"))
    digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:12]
    return f"company:{digest}"


def looks_like_company_credit(entry: dict[str, Any]) -> bool:
    name_raw = normalize_space(entry.get("name"))
    name = name_raw.lower()
    role = normalize_space(entry.get("role")).lower()
    normalized_name = re.sub(r"\s+", " ", name_raw).strip()
    if not name:
        return False
    if "شركة" in role or "جهة الإنتاج" in role:
        return True
    if any(token in name for token in COMPANY_NAME_HINTS):
        return True
    if normalized_name.startswith("أفلام ") or normalized_name.startswith("افلام "):
        return True
    if normalized_name.endswith(" فيلم") or normalized_name.endswith(" افلام"):
        return True
    if "السينمائيين" in normalized_name or ("اتحاد" in normalized_name and "فنان" not in normalized_name):
        return True
    if any(token in role for token in ("إنتاج", "انتاج", "توزيع", "استوديو", "ستوديو")) and len(name.split()) > 1:
        return True
    return False


def company_role_kind(role: Any) -> str:
    normalized = normalize_space(role)
    if "توزيع" in normalized:
        return "distribution"
    if "استوديو" in normalized or "ستوديو" in normalized:
        return "studio"
    if "إنتاج" in normalized or "انتاج" in normalized:
        return "production"
    if "تمويل" in normalized:
        return "financing"
    return "company"


def merge_person_record(base_person: dict[str, Any], enrichment: dict[str, Any], public_asset_base_url: str, image_path: str) -> dict[str, Any]:
    return {
        "id": base_person["id"],
        "name": base_person["name"],
        "name_ar": enrichment.get("name_ar") or base_person["name"],
        "name_en": enrichment.get("name_en") or "",
        "full_name": enrichment.get("full_name") or enrichment.get("name_ar") or base_person["name"],
        "bio": enrichment.get("bio") or "",
        "bio_ar": enrichment.get("bio_ar") or enrichment.get("bio") or "",
        "birthdate": str(enrichment.get("birthdate") or "").strip(),
        "deathdate": str(enrichment.get("deathdate") or "").strip(),
        "country": enrichment.get("country") or "مصر",
        "image_url": f"{public_asset_base_url.rstrip('/')}/{image_path}" if image_path else "",
    }


def is_blank_image(url: str) -> bool:
    return not url or "blank_photos" in url or "no-pic" in url


def choose_person_image_url(credit_image_url: str, profile_image_url: str) -> tuple[str, str]:
    profile_image_url = str(profile_image_url or "").strip()
    credit_image_url = str(credit_image_url or "").strip()
    if not is_blank_image(profile_image_url):
        return profile_image_url, "profile_image"
    if not is_blank_image(credit_image_url):
        return credit_image_url, "credit_image"
    return "", "none"


def extension_from_url(url: str) -> str:
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    return ""


def extension_from_content_type(content_type: str) -> str:
    content_type = content_type.split(";")[0].strip().lower()
    if content_type == "image/jpeg":
        return ".jpg"
    guessed = mimetypes.guess_extension(content_type)
    if guessed == ".jpe":
        return ".jpg"
    return guessed or ".jpg"


def cached_image_is_current(image_mapping: dict[str, Any], url: str, target_stem: Path) -> bool:
    record = image_mapping.get(url, {})
    if not isinstance(record, dict):
        return False
    if record.get("status") != "downloaded":
        return False

    local_path = str(record.get("local_path") or "").strip()
    if not local_path:
        return False

    path = Path(local_path)
    if not path.exists():
        return False

    try:
        return path.parent == target_stem.parent and path.stem == target_stem.name
    except Exception:
        return False


def download_image(url: str, target_stem: Path, retries: int = 2) -> tuple[str, str]:
    target_stem.parent.mkdir(parents=True, exist_ok=True)
    last_error = ""

    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=IMAGE_TIMEOUT_SECONDS) as response:
                content_type = response.headers.get("Content-Type", "")
                data = response.read()
            ext = extension_from_url(url) or extension_from_content_type(content_type)
            target_path = target_stem.with_suffix(ext)
            temp_path = target_stem.with_suffix(ext + ".tmp")
            temp_path.write_bytes(data)

            # Remove any stale asset that previously occupied the same public ID.
            for existing in target_stem.parent.glob(target_stem.name + ".*"):
                if existing != temp_path and existing.exists():
                    existing.unlink()

            os.replace(temp_path, target_path)
            return "downloaded", str(target_path)
        except Exception as error:
            last_error = str(error)
            if attempt < retries:
                time.sleep(1 + attempt)

    return "failed", last_error


def public_url_for_file(base_url: str, asset_root: Path, file_path: Path) -> str:
    rel = file_path.relative_to(asset_root).as_posix()
    return f"{base_url.rstrip('/')}/{rel}"


def build_public_data(
    movies: list[dict[str, Any]],
    public_asset_base_url: str,
    enrichment_map: dict[str, dict[str, Any]],
    people_enrichment_map: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    sorted_movies = sorted(movies, key=movie_sort_key)
    movie_mapping: dict[str, dict[str, Any]] = {}
    person_mapping: dict[str, dict[str, Any]] = {}
    person_public_by_key: dict[str, str] = {}
    people_public: dict[str, dict[str, Any]] = {}
    company_mapping: dict[str, dict[str, Any]] = {}
    company_public_by_key: dict[str, str] = {}
    companies_public: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    movie_company_edges: list[dict[str, Any]] = []
    public_movies: list[dict[str, Any]] = []

    for movie_index, movie in enumerate(sorted_movies, start=1):
        old_movie_id = str(movie.get("id") or "")
        enrichment = enrichment_map.get(old_movie_id, {})
        public_movie_id = new_movie_id(movie_index)
        poster_path = f"posters/{public_movie_id}.jpg" if not is_blank_image(str(movie.get("poster_url") or "")) else ""
        watch_links = sanitize_watch_links(
            (movie.get("watch_links") or [])
            + (enrichment.get("watch_links") or [])
        )
        news = sanitize_articles(
            (movie.get("news") or [])
            + (enrichment.get("news") or []),
            "news",
        )
        reviews = sanitize_articles(
            (movie.get("reviews") or [])
            + (enrichment.get("reviews") or []),
            "review",
        )

        movie_mapping[old_movie_id] = {
            "public_id": public_movie_id,
            "old_id": old_movie_id,
            "source_url": movie.get("url") or "",
            "source_cast_url": movie.get("cast_url") or "",
            "source_poster_url": movie.get("poster_url") or "",
            "title": movie.get("title") or "",
            "year": movie.get("year") or "",
        }

        public_movie = {
            "id": public_movie_id,
            "title": movie.get("title") or "",
            "year": str(movie.get("year") or ""),
            "country": "مصر",
            "work_type": "فيلم",
            "work_subtype": movie.get("work_subtype") or "",
            "title_en": movie.get("title_en") or enrichment.get("title_en") or "",
            "duration": movie.get("duration") or movie.get("duration_str") or enrichment.get("duration") or "",
            "duration_minutes": movie.get("duration_minutes") or enrichment.get("duration_minutes") or 0,
            "rating": movie.get("rating") or 0,
            "poster_url": f"{public_asset_base_url.rstrip('/')}/{poster_path}" if poster_path else "",
            "story": movie.get("story") or "",
            "genres": list(dict.fromkeys(movie.get("genres") or [])),
            "cast": [],
            "crew": [],
            "companies": [],
            "watch_links": watch_links,
            "news": news,
            "reviews": reviews,
        }

        for group in ("cast", "crew"):
            for order, person in enumerate(movie.get(group) or [], start=1):
                if not isinstance(person, dict):
                    continue
                if group == "crew" and looks_like_company_credit(person):
                    key = company_key(person)
                    if key not in company_public_by_key:
                        public_company_id = new_company_id(len(company_public_by_key) + 1)
                        company_public_by_key[key] = public_company_id
                        companies_public[public_company_id] = {
                            "id": public_company_id,
                            "name_ar": person.get("name") or "",
                            "name_en": "",
                            "kind": company_role_kind(person.get("role")),
                            "country": "مصر",
                            "description_ar": "",
                        }
                        company_mapping[key] = {
                            "public_id": public_company_id,
                            "old_id": str(person.get("id") or ""),
                            "name": person.get("name") or "",
                        }

                    public_company_id = company_public_by_key[key]
                    company_credit = {
                        "company_id": public_company_id,
                        "id": public_company_id,
                        "slug": public_company_id,
                        "name_ar": companies_public[public_company_id]["name_ar"],
                        "name_en": companies_public[public_company_id]["name_en"],
                        "role_kind": company_role_kind(person.get("role")),
                    }
                    public_movie["companies"].append(company_credit)
                    movie_company_edges.append(
                        {
                            "movie_id": public_movie_id,
                            "company_id": public_company_id,
                            "role_kind": company_credit["role_kind"],
                            "order": order,
                        }
                    )
                    continue

                key = person_key(person)
                if key not in person_public_by_key:
                    public_person_id = new_person_id(len(person_public_by_key) + 1)
                    person_public_by_key[key] = public_person_id
                    old_person_id = str(person.get("id") or "")
                    enrichment = people_enrichment_map.get(old_person_id, {})
                    credit_image_url = str(person.get("image_url") or "").strip()
                    profile_image_url = str(enrichment.get("profile_image") or "").strip()
                    source_image_url, selected_image_source = choose_person_image_url(
                        credit_image_url,
                        profile_image_url,
                    )
                    image_path = f"people/{public_person_id}.jpg" if source_image_url else ""
                    people_public[public_person_id] = merge_person_record(
                        {
                            "id": public_person_id,
                            "name": person.get("name") or "",
                        },
                        enrichment,
                        public_asset_base_url,
                        image_path,
                    )
                    person_mapping[key] = {
                        "public_id": public_person_id,
                        "old_id": old_person_id,
                        "name": person.get("name") or "",
                        "source_image_url": source_image_url,
                        "source_credit_image_url": credit_image_url,
                        "source_profile_image_url": profile_image_url,
                        "selected_image_source": selected_image_source,
                    }

                public_person_id = person_public_by_key[key]
                public_credit = {
                    "person_id": public_person_id,
                    "name": person.get("name") or people_public[public_person_id]["name"],
                    "role": person.get("role") or "",
                    "image_url": people_public[public_person_id]["image_url"],
                }
                public_movie[group].append(public_credit)
                edges.append(
                    {
                        "movie_id": public_movie_id,
                        "person_id": public_person_id,
                        "credit_type": group,
                        "role": person.get("role") or "",
                        "order": order,
                    }
                )

        public_movies.append(public_movie)

    return {
        "movies": public_movies,
        "people": list(people_public.values()),
        "companies": list(companies_public.values()),
        "edges": edges,
        "movie_company_edges": movie_company_edges,
        "movie_mapping": movie_mapping,
        "person_mapping": person_mapping,
        "company_mapping": company_mapping,
    }


def build_download_jobs(
    public_data: dict[str, Any],
    asset_root: Path,
) -> list[tuple[str, Path, str]]:
    jobs: list[tuple[str, Path, str]] = []

    for old_id, mapping in public_data["movie_mapping"].items():
        url = mapping.get("source_poster_url") or ""
        if is_blank_image(url):
            continue
        public_id = mapping["public_id"]
        jobs.append((url, asset_root / "posters" / public_id, f"poster:{public_id}"))

    for key, mapping in public_data["person_mapping"].items():
        url = mapping.get("source_image_url") or ""
        if is_blank_image(url):
            continue
        public_id = mapping["public_id"]
        jobs.append((url, asset_root / "people" / public_id, f"person:{public_id}"))

    return jobs


def rewrite_image_urls_from_downloads(
    public_data: dict[str, Any],
    image_mapping: dict[str, Any],
    asset_root: Path,
    public_asset_base_url: str,
) -> None:
    poster_urls = {
        item["label"].split(":", 1)[1]: public_url_for_file(public_asset_base_url, asset_root, Path(item["local_path"]))
        for item in image_mapping.values()
        if item.get("status") in {"downloaded", "exists"} and item.get("label", "").startswith("poster:")
    }
    person_urls = {
        item["label"].split(":", 1)[1]: public_url_for_file(public_asset_base_url, asset_root, Path(item["local_path"]))
        for item in image_mapping.values()
        if item.get("status") in {"downloaded", "exists"} and item.get("label", "").startswith("person:")
    }

    for movie in public_data["movies"]:
        if movie["id"] in poster_urls:
            movie["poster_url"] = poster_urls[movie["id"]]
        elif movie["poster_url"]:
            movie["poster_url"] = ""

        for group in ("cast", "crew"):
            for credit in movie[group]:
                credit["image_url"] = person_urls.get(credit["person_id"], "")

    for person in public_data["people"]:
        person["image_url"] = person_urls.get(person["id"], "")


def scan_public_outputs(paths: list[Path]) -> dict[str, int]:
    counts = {term: 0 for term in FORBIDDEN_PUBLIC_STRINGS}
    for path in paths:
        text = path.read_text(encoding="utf-8")
        lowered = text.lower()
        for term in counts:
            counts[term] += lowered.count(term)
    return counts


def unique_public_asset_urls(public_data: dict[str, Any]) -> set[str]:
    urls: set[str] = set()
    for movie in public_data["movies"]:
        if movie.get("poster_url"):
            urls.add(movie["poster_url"])
        for group in ("cast", "crew"):
            for credit in movie.get(group) or []:
                if credit.get("image_url"):
                    urls.add(credit["image_url"])
    for person in public_data["people"]:
        if person.get("image_url"):
            urls.add(person["image_url"])
    return urls


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    public_dir = Path(args.public_output_dir)
    private_dir = Path(args.private_mapping_dir)
    asset_root = Path(args.asset_dir)

    movies = load_json(input_path, [])
    if not isinstance(movies, list):
        print(f"{input_path} must contain a JSON array.", file=sys.stderr)
        return 2

    enrichment_map = load_enrichment_map(args.enrichment)
    people_enrichment_map = load_people_enrichment_map(args.people_enrichment)
    public_data = build_public_data(movies, args.public_asset_base_url, enrichment_map, people_enrichment_map)

    image_mapping_path = private_dir / "image_mapping_private.json"
    image_mapping = load_json(image_mapping_path, {})
    if not isinstance(image_mapping, dict):
        image_mapping = {}

    download_jobs = build_download_jobs(public_data, asset_root)
    if not args.no_download_images:
        print(f"Downloading/verifying {len(download_jobs)} image assets...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
            future_to_job = {
                executor.submit(download_image, url, target_stem): (url, target_stem, label)
                for url, target_stem, label in download_jobs
                if not cached_image_is_current(image_mapping, url, target_stem)
            }
            completed = 0
            for future in concurrent.futures.as_completed(future_to_job):
                url, target_stem, label = future_to_job[future]
                status, detail = future.result()
                local_path = detail if status in {"downloaded", "exists"} else ""
                image_mapping[url] = {
                    "label": label,
                    "status": status,
                    "local_path": local_path,
                    "error": "" if local_path else detail,
                }
                completed += 1
                if completed % 100 == 0:
                    save_json_atomic(image_mapping_path, image_mapping)
                    print(f"  processed {completed}/{len(future_to_job)} new image jobs")
            save_json_atomic(image_mapping_path, image_mapping)
    else:
        for url, target_stem, label in download_jobs:
            existing = list(target_stem.parent.glob(target_stem.name + ".*"))
            if existing:
                image_mapping[url] = {
                    "label": label,
                    "status": "exists",
                    "local_path": str(existing[0]),
                    "error": "",
                }

    rewrite_image_urls_from_downloads(public_data, image_mapping, asset_root, args.public_asset_base_url)

    movies_path = public_dir / "elfilm_movies_public.json"
    people_path = public_dir / "elfilm_people_public.json"
    companies_path = public_dir / "elfilm_companies_public.json"
    edges_path = public_dir / "elfilm_movie_people_edges.json"
    movie_company_edges_path = public_dir / "elfilm_movie_company_edges.json"
    save_json_atomic(movies_path, public_data["movies"])
    save_json_atomic(people_path, public_data["people"])
    save_json_atomic(companies_path, public_data["companies"])
    save_json_atomic(edges_path, public_data["edges"])
    save_json_atomic(movie_company_edges_path, public_data["movie_company_edges"])

    save_json_atomic(private_dir / "movie_id_mapping_private.json", public_data["movie_mapping"])
    save_json_atomic(private_dir / "person_id_mapping_private.json", public_data["person_mapping"])
    save_json_atomic(private_dir / "company_id_mapping_private.json", public_data["company_mapping"])
    save_json_atomic(image_mapping_path, image_mapping)

    public_scan = scan_public_outputs([movies_path, people_path, companies_path, edges_path, movie_company_edges_path])
    public_image_urls = unique_public_asset_urls(public_data)
    downloaded = sum(1 for item in image_mapping.values() if item.get("status") in {"downloaded", "exists"})
    failed = sum(1 for item in image_mapping.values() if item.get("status") == "failed")
    people_using_profile_images = sum(
        1 for item in public_data["person_mapping"].values()
        if item.get("selected_image_source") == "profile_image"
    )
    people_using_credit_images = sum(
        1 for item in public_data["person_mapping"].values()
        if item.get("selected_image_source") == "credit_image"
    )
    report = [
        "# ElFilm Public Dataset Migration Report",
        "",
        f"- Movies: {len(public_data['movies'])}",
        f"- People: {len(public_data['people'])}",
        f"- Companies: {len(public_data['companies'])}",
        f"- Movie-person edges: {len(public_data['edges'])}",
        f"- Movie-company edges: {len(public_data['movie_company_edges'])}",
        f"- Movies with watch links: {sum(1 for movie in public_data['movies'] if movie.get('watch_links'))}",
        f"- Movies with articles: {sum(1 for movie in public_data['movies'] if movie.get('news') or movie.get('reviews'))}",
        f"- Image jobs: {len(download_jobs)}",
        f"- Unique public image URLs: {len(public_image_urls)}",
        f"- Image mapping entries available locally: {downloaded}",
        f"- Image failures: {failed}",
        f"- People using enriched profile images: {people_using_profile_images}",
        f"- People using fallback credit images: {people_using_credit_images}",
        f"- Forbidden source string hits in public JSON: {public_scan}",
        "",
        "Public files:",
        "- elfilm_movies_public.json",
        "- elfilm_people_public.json",
        "- elfilm_companies_public.json",
        "- elfilm_movie_people_edges.json",
        "- elfilm_movie_company_edges.json",
    ]
    (public_dir / "migration_report.md").write_text("\n".join(report) + "\n", encoding="utf-8")

    print("\n".join(report))
    return 0 if all(count == 0 for count in public_scan.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
