#!/usr/bin/env python3
"""
Find official/public watch links for movies still missing watch links using
Cloudflare Browser Rendering as a fallback when Exa is unavailable or weak.

This script intentionally stays on safer/public providers such as YouTube,
Dailymotion, WATCH IT, and Shahid. It does not target likely unlicensed hosts.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.parse
from pathlib import Path
from typing import Any

from cloudflare_crawl_enrich_movies import cloudflare_request, load_json, save_json_atomic


YOUTUBE_ID_RE = re.compile(r'"videoId":"([^"]+)"')
DAILYMOTION_URL_RE = re.compile(r'https://www\.dailymotion\.com/video/([A-Za-z0-9]+)')
WATCHIT_URL_RE = re.compile(r'https://www\.watchit\.com/[^"\')\\s]+')
SHAHID_URL_RE = re.compile(r'https://shahid\.mbc\.net/[^"\')\\s]+')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cloudflare fallback for safer/public movie watch links.")
    parser.add_argument("--input", default="elcinema_egyptian_movies_full.json")
    parser.add_argument("--existing-enrichment", default="exa_movie_enrichment.batch1.json")
    parser.add_argument("--output", default="cloudflare_watch_fallback.batch1.json")
    parser.add_argument("--max-movies", type=int, default=20)
    parser.add_argument("--refresh-existing", action="store_true")
    parser.add_argument("--delay-seconds", type=float, default=0.4)
    return parser.parse_args()


def exa_enrichment_map(path: Path) -> dict[str, dict[str, Any]]:
    payload = load_json(path, [])
    if isinstance(payload, dict):
        return {str(k): v for k, v in payload.items() if isinstance(v, dict)}
    if not isinstance(payload, list):
        return {}
    return {
        str(item.get("movie_id")): item
        for item in payload
        if isinstance(item, dict) and item.get("movie_id")
    }


def existing_output_map(path: Path) -> dict[str, dict[str, Any]]:
    payload = load_json(path, [])
    if isinstance(payload, dict):
        return {str(k): v for k, v in payload.items() if isinstance(v, dict)}
    if not isinstance(payload, list):
        return {}
    return {
        str(item.get("movie_id")): item
        for item in payload
        if isinstance(item, dict) and item.get("movie_id")
    }


def fetch_html(account_id: str, api_token: str, url: str) -> str:
    response = cloudflare_request("POST", account_id, api_token, "content", {"url": url})
    result = response.get("result")
    if isinstance(result, str):
        return result
    if isinstance(result, dict):
        return str(result.get("content") or "")
    return ""


def youtube_search_url(title: str, year: str) -> str:
    query = urllib.parse.quote_plus(f'{title} فيلم كامل {year}'.strip())
    return f"https://www.youtube.com/results?search_query={query}"


def dailymotion_search_url(title: str, year: str) -> str:
    query = urllib.parse.quote_plus(f'{title} فيلم {year}'.strip())
    return f"https://www.dailymotion.com/search/{query}/videos"


def build_watch_link(platform: str, url: str, title: str, source_kind: str) -> dict[str, Any]:
    if platform == "YouTube":
        parsed = urllib.parse.urlparse(url)
        video_id = urllib.parse.parse_qs(parsed.query).get("v", [""])[0]
        embed_url = f"https://www.youtube.com/embed/{video_id}" if video_id else ""
        return {
            "provider_key": "youtube",
            "platform": platform,
            "url": url,
            "title": title,
            "embed_url": embed_url,
            "embed_type": "iframe" if embed_url else "external",
            "source_kind": source_kind,
            "confidence": 0.42,
            "is_official": 0,
            "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    if platform == "Dailymotion":
        match = DAILYMOTION_URL_RE.search(url)
        video_id = match.group(1) if match else ""
        embed_url = f"https://www.dailymotion.com/embed/video/{video_id}" if video_id else ""
        return {
            "provider_key": "dailymotion",
            "platform": platform,
            "url": url,
            "title": title,
            "embed_url": embed_url,
            "embed_type": "iframe" if embed_url else "external",
            "source_kind": source_kind,
            "confidence": 0.38,
            "is_official": 0,
            "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    provider_key = "watchit" if platform == "WATCH IT" else "shahid"
    return {
        "provider_key": provider_key,
        "platform": platform,
        "url": url,
        "title": title,
        "embed_url": "",
        "embed_type": "external",
        "source_kind": source_kind,
        "confidence": 0.35,
        "is_official": 1,
        "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def extract_youtube_links(html: str, title: str, limit: int = 2) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen: set[str] = set()
    for video_id in YOUTUBE_ID_RE.findall(html):
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)
        links.append(build_watch_link("YouTube", f"https://www.youtube.com/watch?v={video_id}", title, "cloudflare-youtube-search"))
        if len(links) >= limit:
            break
    return links


def extract_dailymotion_links(html: str, title: str, limit: int = 2) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen: set[str] = set()
    for video_id in DAILYMOTION_URL_RE.findall(html):
        if not video_id or video_id in seen:
            continue
        seen.add(video_id)
        links.append(build_watch_link("Dailymotion", f"https://www.dailymotion.com/video/{video_id}", title, "cloudflare-dailymotion-search"))
        if len(links) >= limit:
            break
    return links


def extract_single_regex_links(pattern: re.Pattern[str], html: str, platform: str, title: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    links: list[dict[str, Any]] = []
    for url in pattern.findall(html):
        if url in seen:
            continue
        seen.add(url)
        links.append(build_watch_link(platform, url, title, "cloudflare-provider-search"))
    return links[:1]


def dedupe_watch_links(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        url = str(item.get("url") or "").strip()
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(item)
    return deduped


def enrich_movie(account_id: str, api_token: str, movie: dict[str, Any]) -> dict[str, Any]:
    title = str(movie.get("title") or "").strip()
    year = str(movie.get("year") or "").strip()
    links: list[dict[str, Any]] = []

    youtube_html = fetch_html(account_id, api_token, youtube_search_url(title, year))
    links.extend(extract_youtube_links(youtube_html, title))

    dailymotion_html = fetch_html(account_id, api_token, dailymotion_search_url(title, year))
    links.extend(extract_dailymotion_links(dailymotion_html, title))
    links.extend(extract_single_regex_links(WATCHIT_URL_RE, dailymotion_html, "WATCH IT", title))
    links.extend(extract_single_regex_links(SHAHID_URL_RE, dailymotion_html, "Shahid", title))

    return {
        "movie_id": str(movie.get("id") or ""),
        "title": title,
        "year": year,
        "watch_links": dedupe_watch_links(links),
        "news": [],
        "reviews": [],
        "enriched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "cloudflare_browser_rendering",
    }


def main() -> int:
    args = parse_args()
    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not account_id or not api_token:
        raise SystemExit("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN before running.")

    movies = load_json(Path(args.input), [])
    if not isinstance(movies, list):
        raise SystemExit("Input file must contain a JSON array.")

    exa_map = exa_enrichment_map(Path(args.existing_enrichment))
    output_map = existing_output_map(Path(args.output))
    processed = 0

    for movie in movies:
        movie_id = str(movie.get("id") or "")
        if not movie_id:
            continue
        if movie_id in output_map and not args.refresh_existing:
            continue
        if exa_map.get(movie_id, {}).get("watch_links"):
            continue
        if processed >= args.max_movies:
            break
        print(f"[{processed + 1}/{args.max_movies}] Cloudflare fallback for {movie.get('title') or movie_id}")
        try:
            output_map[movie_id] = enrich_movie(account_id, api_token, movie)
        except Exception as error:
            print(f"Failed {movie.get('title') or movie_id}: {error}")
            continue
        processed += 1
        save_json_atomic(Path(args.output), sorted(output_map.values(), key=lambda item: str(item.get("movie_id") or "")))
        time.sleep(args.delay_seconds)

    print(f"Saved {len(output_map)} Cloudflare fallback movie records to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
