"""
Build an Egyptian-movies-only list from ElCinema using Cloudflare /crawl.

Source page:
https://elcinema.com/index/work/country/eg

That index contains every Egyptian work type, so this script filters the
extracted rows and keeps only works whose type contains "فيلم" (movie/short
movie). It writes a list compatible with the repo's existing
elcinema_movies_list.json shape.

Required environment variables:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN

Example:
    python scripts/cloudflare_elcinema_egyptian_movies.py --max-pages 25
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import re
import sys
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from cloudflare_crawl_enrich_movies import (
    cloudflare_request,
    load_json,
    save_json_atomic,
)


BASE_URL = "https://elcinema.com/index/work/country/eg"
DEFAULT_OUTPUT = "elcinema_egyptian_movies_cloudflare.json"

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape Egyptian movie rows from ElCinema via Cloudflare crawl.")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output JSON list.")
    parser.add_argument("--max-pages", type=int, default=520, help="Highest ElCinema index page to request.")
    parser.add_argument("--start-page", type=int, default=1, help="First ElCinema index page to request.")
    parser.add_argument("--max-wait-seconds", type=int, default=3600, help="Maximum wait for the Cloudflare crawl job.")
    parser.add_argument("--poll-seconds", type=float, default=5.0, help="Seconds between crawl status checks.")
    parser.add_argument("--render", action=argparse.BooleanOptionalAction, default=False, help="Execute JavaScript.")
    parser.add_argument("--concurrency", type=int, default=4, help="Number of index pages to fetch in parallel.")
    return parser.parse_args()


def page_url(page: int) -> str:
    return BASE_URL if page == 1 else f"{BASE_URL}?page={page}"


def build_payload(args: argparse.Namespace) -> dict[str, Any]:
    page_count = args.max_pages - args.start_page + 1
    return {
        "url": page_url(args.start_page),
        "limit": page_count,
        "depth": page_count,
        "source": "links",
        "formats": ["html"],
        "render": args.render,
        "crawlPurposes": ["search", "ai-input"],
        "options": {
            "includePatterns": [
                "https://elcinema.com/index/work/country/eg**",
            ],
            "excludePatterns": [
                "https://elcinema.com/work/**",
                "https://elcinema.com/person/**",
                "https://elcinema.com/en/**",
            ],
        },
    }


def build_page_payload(page: int, args: argparse.Namespace) -> dict[str, Any]:
    return {
        "url": page_url(page),
        "limit": 1,
        "depth": 1,
        "source": "links",
        "formats": ["html"],
        "render": args.render,
        "crawlPurposes": ["search", "ai-input"],
    }


def fetch_page_html(account_id: str, api_token: str, page: int) -> str:
    response = cloudflare_request(
        "POST",
        account_id,
        api_token,
        "content",
        {"url": page_url(page)},
    )
    result = response.get("result")
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        return str(result.get("content") or "")
    return ""


def absolute_elcinema_url(url: str) -> str:
    if url.startswith("https://elcinema.com/"):
        return url
    if url.startswith("/"):
        return f"https://elcinema.com{url}"
    return url


def work_id_from_url(url: str) -> str:
    parts = absolute_elcinema_url(url).rstrip("/").split("/")
    return parts[-1] if parts else ""


def is_movie_work(work: dict[str, Any]) -> bool:
    work_type = str(work.get("work_type") or "")
    subtype = str(work.get("work_subtype") or "")
    combined = f"{work_type} {subtype}"
    return "فيلم" in combined


def parse_rating(text: str) -> float | None:
    match = re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def normalize_work(work: dict[str, Any]) -> dict[str, Any]:
    url = absolute_elcinema_url(str(work.get("url") or ""))
    return {
        "title": str(work.get("title") or "").strip(),
        "url": url,
        "id": work_id_from_url(url),
        "year": str(work.get("year") or "").strip(),
        "country": "مصر",
        "source": "elcinema",
        "work_type": str(work.get("work_type") or "").strip(),
        "work_subtype": str(work.get("work_subtype") or "").strip(),
        "rating": work.get("rating"),
    }


def extract_works_from_html(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    works = []

    for row in soup.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) < 5:
            continue

        links = cols[1].find_all("a", href=True)
        title = ""
        href = ""
        for link in links:
            text = link.get_text(" ", strip=True)
            if text:
                title = text
                href = link["href"]
                break
        if not href and links:
            href = links[-1]["href"]

        if not href or "/work/" not in href:
            continue

        works.append(
            {
                "title": title,
                "url": href,
                "work_type": cols[2].get_text(" ", strip=True),
                "work_subtype": cols[3].get_text(" ", strip=True),
                "year": cols[4].get_text(" ", strip=True),
                "rating": parse_rating(cols[5].get_text(" ", strip=True)) if len(cols) > 5 else None,
            }
        )

    return works


def extract_movies(result: dict[str, Any]) -> list[dict[str, Any]]:
    movies_by_id: dict[str, dict[str, Any]] = {}
    for record in result.get("records", []):
        if record.get("status") != "completed":
            continue
        works = extract_works_from_html(record.get("html") or "")
        for work in works:
            if not isinstance(work, dict) or not is_movie_work(work):
                continue
            movie = normalize_work(work)
            if movie["id"] and movie["title"]:
                movies_by_id[movie["id"]] = movie
    return list(movies_by_id.values())


def main() -> int:
    args = parse_args()
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")

    if not account_id or not api_token:
        print("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN before running.", file=sys.stderr)
        return 2

    output_path = Path(args.output)
    movies = load_json(output_path, [])
    if not isinstance(movies, list):
        print(f"{args.output} must contain a JSON array if it already exists.", file=sys.stderr)
        return 2

    movies_by_id = {str(movie.get("id")): movie for movie in movies if isinstance(movie, dict) and movie.get("id")}

    print(f"Starting ElCinema Egypt index crawl for pages {args.start_page}-{args.max_pages}...")
    pages = list(range(args.start_page, args.max_pages + 1))
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        future_to_page = {
            executor.submit(fetch_page_html, account_id, api_token, page): page
            for page in pages
        }

        for future in concurrent.futures.as_completed(future_to_page):
            page = future_to_page[future]
            try:
                html = future.result()
                page_movies = extract_movies({"records": [{"status": "completed", "html": html}]})
            except Exception as error:
                print(f"Page {page}/{args.max_pages} failed: {error}")
                continue

            for movie in page_movies:
                movies_by_id[movie["id"]] = movie
            save_json_atomic(output_path, list(movies_by_id.values()))
            print(f"Page {page}/{args.max_pages}: added {len(page_movies)}; total unique movies: {len(movies_by_id)}")

    print(f"Saved {len(movies_by_id)} Egyptian movie rows to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
