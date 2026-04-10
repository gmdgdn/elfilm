"""
Enrich movie records with Cloudflare Browser Rendering's /crawl endpoint.

The repo has two main movie source shapes:
- Dhliz per-year files such as movies_2025_details.json
- ElCinema/master files such as elcinema_movies_details.json and movies_unified.json

This script keeps the output as a sidecar JSON file so you can inspect the
Cloudflare extraction before merging it into master data.

Required environment variables:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

Example:
    python scripts/cloudflare_crawl_enrich_movies.py ^
      --input movies_needing_enrichment.json ^
      --output cloudflare_movies_enriched.json ^
      --max-movies 25

By default, the script only processes Egyptian movies. Records with an
explicit country must contain Egypt/مصر, and records with no country are
trusted because this repo's movie inputs are Egyptian-focused datasets.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


API_BASE = "https://api.cloudflare.com/client/v4/accounts"
ALLOWED_DOMAINS = {"elcinema.com", "www.elcinema.com", "dhliz.com", "www.dhliz.com"}
EGYPT_MARKERS = ("مصر", "egypt")
TERMINAL_STATUSES = {
    "completed",
    "errored",
    "cancelled_due_to_timeout",
    "cancelled_due_to_limits",
    "cancelled_by_user",
}


MOVIE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "year": {"type": "string"},
        "poster_url": {"type": "string"},
        "story": {"type": "string"},
        "genres": {"type": "array", "items": {"type": "string"}},
        "duration_str": {"type": "string"},
        "rating": {"type": "number"},
        "cast": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "image_url": {"type": "string"},
                },
                "required": ["name"],
            },
        },
        "crew": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "image_url": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
}


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json_atomic(path: Path, data: Any) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(temp_path, path)


def cloudflare_request(
    method: str,
    account_id: str,
    api_token: str,
    path: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    url = f"{API_BASE}/{account_id}/browser-rendering/{path.lstrip('/')}"
    data = None
    headers = {"Authorization": f"Bearer {api_token}"}

    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Cloudflare API error {error.code}: {detail}") from error


def build_crawl_payload(movie: dict[str, Any], args: argparse.Namespace) -> dict[str, Any]:
    title = movie.get("title") or ""
    year = str(movie.get("year") or "")
    url = movie["url"]

    prompt = (
        "Extract Egyptian movie metadata from this Arabic movie page. "
        "Return only facts visible on the page. Preserve Arabic names and text. "
        "For cast and crew, include the person name, role when visible, and image URL when visible. "
        f"The input record title is {title!r} and year is {year!r}."
    )

    payload: dict[str, Any] = {
        "url": url,
        "limit": 1,
        "depth": 1,
        "source": "links",
        "formats": ["json", "markdown"] if args.include_markdown else ["json"],
        "render": args.render,
        "crawlPurposes": args.crawl_purposes,
        "jsonOptions": {
            "prompt": prompt,
            "response_format": {
                "type": "json_schema",
                "json_schema": MOVIE_SCHEMA,
            },
        },
    }

    if args.wait_selector:
        payload["waitForSelector"] = {
            "selector": args.wait_selector,
            "timeout": args.wait_selector_timeout,
            "visible": True,
        }

    if args.reject_resource_types:
        payload["rejectResourceTypes"] = args.reject_resource_types

    return payload


def domain_allowed(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    return host in ALLOWED_DOMAINS


def is_egyptian_movie(movie: dict[str, Any], trust_missing_country: bool) -> bool:
    country = movie.get("country")
    if country is None or country == "":
        countries = movie.get("countries")
        if isinstance(countries, list):
            country = " ".join(str(item) for item in countries)

    if country is None or country == "":
        return trust_missing_country

    country_text = str(country).lower()
    return any(marker in country_text for marker in EGYPT_MARKERS)


def record_key(movie: dict[str, Any]) -> str:
    return str(movie.get("id") or movie.get("url") or movie.get("title"))


def start_crawl(account_id: str, api_token: str, payload: dict[str, Any]) -> str:
    response = cloudflare_request("POST", account_id, api_token, "crawl", payload)
    if not response.get("success"):
        raise RuntimeError(f"Could not start crawl: {response}")
    return response["result"]


def get_crawl(account_id: str, api_token: str, job_id: str, limit: int | None = None) -> dict[str, Any]:
    path = f"crawl/{job_id}"
    query = {}
    if limit is not None:
        query["limit"] = str(limit)
    if query:
        path += "?" + urllib.parse.urlencode(query)
    response = cloudflare_request("GET", account_id, api_token, path)
    if not response.get("success"):
        raise RuntimeError(f"Could not fetch crawl result: {response}")
    return response["result"]


def get_all_crawl_records(
    account_id: str,
    api_token: str,
    job_id: str,
    status: str = "completed",
    limit: int = 100,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    cursor = None

    while True:
        query = {"limit": str(limit), "status": status}
        if cursor is not None:
            query["cursor"] = str(cursor)
        path = f"crawl/{job_id}?" + urllib.parse.urlencode(query)
        response = cloudflare_request("GET", account_id, api_token, path)
        if not response.get("success"):
            raise RuntimeError(f"Could not fetch crawl records: {response}")
        result = response["result"]
        records.extend(result.get("records", []))
        cursor = result.get("cursor")
        if not cursor:
            return records


def wait_for_crawl(
    account_id: str,
    api_token: str,
    job_id: str,
    poll_seconds: float,
    max_wait_seconds: int,
) -> dict[str, Any]:
    deadline = time.time() + max_wait_seconds
    while time.time() < deadline:
        result = get_crawl(account_id, api_token, job_id, limit=1)
        status = result.get("status")
        if status in TERMINAL_STATUSES:
            return get_crawl(account_id, api_token, job_id)
        time.sleep(poll_seconds)
    raise TimeoutError(f"Crawl job {job_id} did not finish within {max_wait_seconds} seconds")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich movie JSON with Cloudflare Browser Rendering crawl.")
    parser.add_argument("--input", default="movies_needing_enrichment.json", help="Input JSON array of movie records.")
    parser.add_argument("--output", default="cloudflare_movies_enriched.json", help="Sidecar output JSON file.")
    parser.add_argument("--max-movies", type=int, default=25, help="Maximum new movies to process in this run.")
    parser.add_argument(
        "--egyptian-only",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Only process Egyptian movies. Enabled by default.",
    )
    parser.add_argument(
        "--trust-missing-country",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Treat records with no country field as Egyptian because this repo's inputs are Egyptian datasets.",
    )
    parser.add_argument("--poll-seconds", type=float, default=5.0, help="Seconds between crawl status checks.")
    parser.add_argument("--max-wait-seconds", type=int, default=300, help="Maximum wait per movie crawl job.")
    parser.add_argument("--render", action=argparse.BooleanOptionalAction, default=False, help="Execute JavaScript.")
    parser.add_argument("--include-markdown", action="store_true", help="Store extracted markdown next to JSON.")
    parser.add_argument("--wait-selector", default="", help="Optional CSS selector to wait for when --render is true.")
    parser.add_argument("--wait-selector-timeout", type=int, default=30000)
    parser.add_argument(
        "--crawl-purposes",
        nargs="+",
        default=["search", "ai-input"],
        choices=["search", "ai-input", "ai-train"],
        help="Declared Content Signals purposes.",
    )
    parser.add_argument(
        "--reject-resource-types",
        nargs="*",
        default=[],
        help="Resource types to block while crawling. Pass no values to disable.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")

    if not account_id or not api_token:
        print("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN before running.", file=sys.stderr)
        return 2

    input_path = Path(args.input)
    output_path = Path(args.output)
    movies = load_json(input_path, [])
    if not isinstance(movies, list):
        print(f"{input_path} must contain a JSON array.", file=sys.stderr)
        return 2

    enriched = load_json(output_path, [])
    if not isinstance(enriched, list):
        print(f"{output_path} must contain a JSON array if it already exists.", file=sys.stderr)
        return 2

    completed_keys = {record_key(item.get("input", item)) for item in enriched}
    processed = 0

    for movie in movies:
        if processed >= args.max_movies:
            break
        if not isinstance(movie, dict) or not movie.get("url"):
            continue
        if record_key(movie) in completed_keys:
            continue
        if args.egyptian_only and not is_egyptian_movie(movie, args.trust_missing_country):
            continue
        if not domain_allowed(movie["url"]):
            continue

        title = movie.get("title") or movie["url"]
        print(f"[{processed + 1}/{args.max_movies}] Cloudflare crawl: {title}")
        record: dict[str, Any] = {"input": movie, "status": "started"}

        try:
            payload = build_crawl_payload(movie, args)
            job_id = start_crawl(account_id, api_token, payload)
            record["job_id"] = job_id
            result = wait_for_crawl(
                account_id,
                api_token,
                job_id,
                poll_seconds=args.poll_seconds,
                max_wait_seconds=args.max_wait_seconds,
            )
            record["status"] = result.get("status")
            record["browserSecondsUsed"] = result.get("browserSecondsUsed")
            record["records"] = result.get("records", [])
        except Exception as error:
            record["status"] = "failed"
            record["error"] = str(error)

        enriched.append(record)
        completed_keys.add(record_key(movie))
        processed += 1
        save_json_atomic(output_path, enriched)

    print(f"Saved {len(enriched)} Cloudflare enrichment records to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
