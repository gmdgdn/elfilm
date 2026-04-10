"""
Scrape ElCinema movie detail pages through Cloudflare Browser Rendering /content.

This is intended for known Egyptian movie URLs, for example the delta produced
by cloudflare_elcinema_egyptian_movies.py.

Required environment variables:
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_API_TOKEN
"""

from __future__ import annotations

import argparse
import concurrent.futures
import os
import sys
import time
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

from cloudflare_crawl_enrich_movies import cloudflare_request, load_json, save_json_atomic


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape ElCinema movie details via Cloudflare Browser Rendering.")
    parser.add_argument("--input", default="elcinema_egyptian_movies_cloudflare.json")
    parser.add_argument("--output", default="elcinema_egyptian_movies_full.json")
    parser.add_argument("--failures-output", default="", help="Failed movie records. Defaults to <output stem>_failed.json.")
    parser.add_argument("--max-movies", type=int, default=0, help="Maximum movies to process. 0 means all.")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--retries", type=int, default=2, help="Retries per Cloudflare content request.")
    return parser.parse_args()


def fetch_html(account_id: str, api_token: str, url: str, retries: int) -> str:
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            response = cloudflare_request("POST", account_id, api_token, "content", {"url": url})
            result = response.get("result")
            if isinstance(result, str):
                return result
            if isinstance(result, dict):
                return str(result.get("content") or "")
            return ""
        except Exception as error:
            last_error = error
            if attempt < retries:
                time.sleep(2 * (attempt + 1))

    raise RuntimeError(str(last_error))


def parse_movie_page(movie: dict[str, Any], html: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    enriched = dict(movie)

    poster_url = ""
    og_image = soup.find("meta", property="og:image")
    if og_image:
        poster_url = og_image.get("content") or ""

    story = ""
    intro_div = soup.find("div", class_="intro-box")
    if intro_div:
        for paragraph in intro_div.find_all("p"):
            text = paragraph.get_text(" ", strip=True)
            if len(text) > 20 and "طاقم العمل" not in text:
                story = text
                break

    genres = [
        link.get_text(" ", strip=True)
        for link in soup.find_all("a", href=lambda href: href and "/index/work/genre/" in href)
    ]

    enriched["poster_url"] = poster_url
    enriched["story"] = story
    enriched["genres"] = genres
    enriched.setdefault("cast", [])
    enriched.setdefault("crew", [])
    return enriched


def parse_cast_page(html: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    soup = BeautifulSoup(html, "html.parser")
    cast: list[dict[str, Any]] = []
    crew: list[dict[str, Any]] = []

    for panel in soup.find_all("div", class_="row"):
        role_header = panel.find("h3", class_="section-title")
        role_name = role_header.get_text(" ", strip=True) if role_header else ""
        if not role_name:
            continue

        for item in panel.find_all("div", class_="thumbnail-wrapper"):
            description = item.find("ul", class_="description")
            link = description.find("a", href=True) if description else item.find("a", href=True)
            if not link or "/person/" not in link["href"]:
                continue

            href_parts = link["href"].strip("/").split("/")
            person_id = href_parts[1] if len(href_parts) > 1 else ""
            image = item.find("img")
            image_url = ""
            if image:
                image_url = image.get("src") or image.get("data-src") or ""
            subheader = item.find("li", class_="subheader")
            character = subheader.get_text(" ", strip=True).strip("() ") if subheader else ""

            person = {
                "id": person_id,
                "name": link.get_text(" ", strip=True),
                "role": character or role_name,
                "image_url": image_url,
            }

            if "تمثيل" in role_name or "ﺗﻤﺜﻴﻞ" in role_name or "Cast" in role_name:
                cast.append(person)
            else:
                crew.append(person)

    return cast, crew


def enrich_one(account_id: str, api_token: str, movie: dict[str, Any], retries: int) -> dict[str, Any]:
    url = movie["url"]
    enriched = parse_movie_page(movie, fetch_html(account_id, api_token, url, retries))
    cast, crew = parse_cast_page(fetch_html(account_id, api_token, url.rstrip("/") + "/cast", retries))
    enriched["cast"] = cast
    enriched["crew"] = crew
    enriched["country"] = "مصر"
    enriched["source"] = "elcinema"
    enriched["cast_url"] = url.rstrip("/") + "/cast"
    return enriched


def main() -> int:
    args = parse_args()
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")

    if not account_id or not api_token:
        print("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN before running.", file=sys.stderr)
        return 2

    input_movies = load_json(Path(args.input), [])
    output_movies = load_json(Path(args.output), [])
    failures_path = Path(args.failures_output) if args.failures_output else Path(args.output).with_name(
        Path(args.output).stem + "_failed.json"
    )
    failures = load_json(failures_path, [])
    if not isinstance(input_movies, list) or not isinstance(output_movies, list):
        print("Input and output files must contain JSON arrays.", file=sys.stderr)
        return 2
    if not isinstance(failures, list):
        print(f"{failures_path} must contain a JSON array if it already exists.", file=sys.stderr)
        return 2

    done_ids = {str(movie.get("id")) for movie in output_movies if isinstance(movie, dict) and movie.get("id")}
    todo = [movie for movie in input_movies if isinstance(movie, dict) and movie.get("url") and str(movie.get("id")) not in done_ids]
    if args.max_movies:
        todo = todo[: args.max_movies]

    output_by_id = {str(movie.get("id")): movie for movie in output_movies if isinstance(movie, dict) and movie.get("id")}
    failures_by_id = {str(movie.get("id")): movie for movie in failures if isinstance(movie, dict) and movie.get("id")}
    print(f"Input: {len(input_movies)} | already done: {len(output_by_id)} | todo this run: {len(todo)}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        future_to_movie = {
            executor.submit(enrich_one, account_id, api_token, movie, args.retries): movie
            for movie in todo
        }

        for future in concurrent.futures.as_completed(future_to_movie):
            movie = future_to_movie[future]
            title = movie.get("title") or movie.get("url")
            try:
                enriched = future.result()
            except Exception as error:
                print(f"Failed: {title}: {error}")
                failed = dict(movie)
                failed["error"] = str(error)
                failures_by_id[str(movie.get("id"))] = failed
                save_json_atomic(failures_path, list(failures_by_id.values()))
                continue

            output_by_id[str(enriched["id"])] = enriched
            failures_by_id.pop(str(enriched["id"]), None)
            save_json_atomic(Path(args.output), list(output_by_id.values()))
            save_json_atomic(failures_path, list(failures_by_id.values()))
            print(f"Saved: {title}; total: {len(output_by_id)}")

    save_json_atomic(Path(args.output), list(output_by_id.values()))
    save_json_atomic(failures_path, list(failures_by_id.values()))
    print(f"Done. Saved {len(output_by_id)} details to {args.output}")
    print(f"Failures remaining: {len(failures_by_id)} in {failures_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
