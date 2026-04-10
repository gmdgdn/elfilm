#!/usr/bin/env python3
"""
Enrich movie records with Exa-powered watch-link and article discovery.

This script is intentionally resumable and writes a compact sidecar file keyed
by source movie ID. The sidecar can then be merged into the public dataset
builder without mutating the source movie dump.

Environment:
  EXA_API_KEYS="key-one,key-two"
or
  EXA_API_KEY="single-key"

Example:
  python scripts/exa_enrich_movies.py ^
    --input elcinema_egyptian_movies_full.json ^
    --output exa_movie_enrichment.json ^
    --max-movies 25
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from exa_py import Exa

from source_registry import is_blocked_article_domain as registry_is_blocked_article_domain
from source_registry import is_trusted_embed_source


ARTICLE_EXCLUDE_DOMAINS = [
    "elcinema.com",
    "www.elcinema.com",
    "dhliz.com",
    "www.dhliz.com",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "dailymotion.com",
    "www.dailymotion.com",
    "ok.ru",
    "www.ok.ru",
    "m.ok.ru",
]

WATCH_PROVIDER_CONFIGS = [
    {
        "provider_key": "youtube",
        "platform": "YouTube",
        "domains": ["youtube.com", "www.youtube.com", "youtu.be"],
        "query_suffixes": ['فيلم كامل', 'المشهد الكامل', 'movie'],
        "embeddable": True,
    },
    {
        "provider_key": "dailymotion",
        "platform": "Dailymotion",
        "domains": ["dailymotion.com", "www.dailymotion.com"],
        "query_suffixes": ['فيلم كامل', 'movie'],
        "embeddable": True,
    },
    {
        "provider_key": "okru",
        "platform": "OK.ru",
        "domains": ["ok.ru", "www.ok.ru", "m.ok.ru"],
        "query_suffixes": ['فيلم كامل', 'movie'],
        "embeddable": False,
    },
    {
        "provider_key": "watchit",
        "platform": "WATCH IT",
        "domains": ["watchit.com", "www.watchit.com", "watchit.com.eg", "www.watchit.com.eg"],
        "query_suffixes": ['مشاهدة', 'watch'],
        "embeddable": False,
    },
    {
        "provider_key": "shahid",
        "platform": "Shahid",
        "domains": ["shahid.mbc.net", "www.shahid.mbc.net"],
        "query_suffixes": ['مشاهدة', 'watch'],
        "embeddable": False,
    },
]

YOUTUBE_RESULT_RE = re.compile(r'"videoId":"([^"]+)"')
YOUTUBE_WATCH_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
DIRECT_MEDIA_EXTENSIONS = (".mp4", ".m3u8", ".webm", ".mpd", ".m4v")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich movie watch links and articles using Exa.")
    parser.add_argument("--input", default="elcinema_egyptian_movies_full.json")
    parser.add_argument("--output", default="exa_movie_enrichment.json")
    parser.add_argument("--max-movies", type=int, default=25)
    parser.add_argument("--movie-id", action="append", default=[], help="Restrict to a specific source movie ID.")
    parser.add_argument("--title-match", action="append", default=[], help="Restrict to titles containing this text.")
    parser.add_argument("--query-delay-seconds", type=float, default=0.8)
    parser.add_argument("--max-article-results", type=int, default=4)
    parser.add_argument("--max-watch-results", type=int, default=3)
    parser.add_argument("--skip-youtube-fallback", action="store_true")
    parser.add_argument("--refresh-existing", action="store_true", help="Re-enrich movie IDs already present in the output file.")
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


def normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    text = text.replace("ة", "ه").replace("ى", "ي")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


def movie_title_variants(movie: dict[str, Any]) -> list[str]:
    values = [movie.get("title"), movie.get("title_ar"), movie.get("title_en")]
    variants: list[str] = []
    seen: set[str] = set()
    for value in values:
        norm = normalize_text(value)
        if norm and norm not in seen:
            variants.append(str(value).strip())
            seen.add(norm)
    return variants


def text_contains_title(movie: dict[str, Any], haystack: str) -> bool:
    normalized_haystack = normalize_text(haystack)
    for variant in movie_title_variants(movie):
        if normalize_text(variant) in normalized_haystack:
            return True
    return False


def published_year(movie: dict[str, Any]) -> str:
    year = str(movie.get("year") or "").strip()
    return year if year.isdigit() else ""


def exa_keys_from_env() -> list[str]:
    joined = os.environ.get("EXA_API_KEYS") or os.environ.get("EXA_API_KEY") or ""
    return [item.strip() for item in joined.split(",") if item.strip()]


@dataclass
class ExaPool:
    keys: list[str]
    clients: list[Exa]
    cursor: int = 0

    @classmethod
    def from_keys(cls, keys: list[str]) -> "ExaPool":
        if not keys:
            raise ValueError("Set EXA_API_KEYS or EXA_API_KEY before running this script.")
        return cls(keys=keys, clients=[Exa(api_key=key) for key in keys])

    def next_client(self) -> Exa:
        client = self.clients[self.cursor]
        self.cursor = (self.cursor + 1) % len(self.clients)
        return client

    def search(self, query: str, **kwargs: Any):
        last_error: Exception | None = None
        for _ in self.clients:
            client = self.next_client()
            try:
                return client.search(query, **kwargs)
            except Exception as error:  # pragma: no cover - depends on API/network
                last_error = error
                time.sleep(0.25)
        raise RuntimeError(f"All Exa keys failed for query {query!r}: {last_error}")


def safe_result_text(result: Any, limit: int = 280) -> str:
    return (getattr(result, "text", None) or "")[:limit]


def result_title(result: Any) -> str:
    return getattr(result, "title", None) or ""


def result_url(result: Any) -> str:
    return getattr(result, "url", None) or ""


def result_published_at(result: Any) -> str | None:
    return getattr(result, "published_date", None) or None


def infer_provider(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    if host in YOUTUBE_WATCH_HOSTS:
        return "youtube"
    if "dailymotion.com" in host:
        return "dailymotion"
    if host.endswith("ok.ru"):
        return "okru"
    if "watchit" in host:
        return "watchit"
    if "shahid" in host:
        return "shahid"
    return host or "external"


def derive_embed_data(url: str) -> tuple[str, str | None]:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path or ""

    if any(path.lower().endswith(ext) for ext in DIRECT_MEDIA_EXTENSIONS):
        return "direct", url

    if host in YOUTUBE_WATCH_HOSTS:
        if host == "youtu.be":
            video_id = path.strip("/").split("/")[0]
        elif path.startswith("/embed/"):
            video_id = path.split("/embed/", 1)[1].split("/", 1)[0]
        elif path.startswith("/shorts/"):
            video_id = path.split("/shorts/", 1)[1].split("/", 1)[0]
        else:
            video_id = urllib.parse.parse_qs(parsed.query).get("v", [""])[0]
        if video_id and is_trusted_embed_source(host):
            return "iframe", f"https://www.youtube.com/embed/{video_id}"

    if "dailymotion.com" in host:
        video_id = ""
        if "/video/" in path:
            video_id = path.split("/video/", 1)[1].split("_", 1)[0].split("/", 1)[0]
        elif "/embed/video/" in path:
            video_id = path.split("/embed/video/", 1)[1].split("/", 1)[0]
        if video_id and is_trusted_embed_source(host):
            return "iframe", f"https://www.dailymotion.com/embed/video/{video_id}"

    return "external", None


def article_domain(url: str) -> str:
    return urllib.parse.urlparse(url).netloc.lower().replace("www.", "")


def dedupe_entries(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        value = str(item.get(key) or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        deduped.append(item)
    return deduped


def search_articles(pool: ExaPool, movie: dict[str, Any], category: str, limit: int) -> list[dict[str, Any]]:
    title = movie.get("title") or movie.get("title_ar") or ""
    year = published_year(movie)
    category_hint = "مراجعة نقد" if category == "review" else "أخبار مقابلة كواليس"
    query = f'"{title}" فيلم {year} {category_hint}'.strip()

    response = pool.search(
        query,
        type="auto",
        num_results=max(limit * 2, 6),
        exclude_domains=ARTICLE_EXCLUDE_DOMAINS,
        contents={"text": {"max_characters": 600}},
    )

    results: list[dict[str, Any]] = []
    for result in response.results:
        url = result_url(result)
        if not url:
            continue
        domain = article_domain(url)
        if registry_is_blocked_article_domain(domain):
            continue
        title_text = result_title(result)
        snippet = safe_result_text(result, 240)
        combined = " ".join([title_text, snippet, url])
        if not text_contains_title(movie, combined):
            continue
        results.append(
            {
                "category": category,
                "title": title_text,
                "link": url,
                "snippet": snippet,
                "domain": domain,
                "published_at": result_published_at(result),
            }
        )
        if len(results) >= limit:
            break
    return dedupe_entries(results, "link")


def score_watch_result(movie: dict[str, Any], title_text: str, text: str) -> float:
    title_match = text_contains_title(movie, " ".join([title_text, text]))
    year = published_year(movie)
    year_match = bool(year and year in " ".join([title_text, text]))
    watch_language = any(token in normalize_text(" ".join([title_text, text])) for token in ["فيلم", "مشاهده", "watch", "full movie"])
    score = 0.45
    if title_match:
        score += 0.3
    if year_match:
        score += 0.15
    if watch_language:
        score += 0.1
    return round(min(score, 0.99), 2)


def build_watch_link(movie: dict[str, Any], result: Any, provider_key: str, platform: str) -> dict[str, Any] | None:
    url = result_url(result)
    if not url:
        return None
    title_text = result_title(result)
    text = safe_result_text(result, 240)
    combined = " ".join([title_text, text, url])
    if not text_contains_title(movie, combined):
        return None

    embed_type, embed_url = derive_embed_data(url)
    return {
        "provider_key": provider_key or infer_provider(url),
        "platform": platform,
        "url": url,
        "title": title_text or (movie.get("title") or ""),
        "embed_type": embed_type,
        "embed_url": embed_url,
        "source_kind": "exa",
        "confidence": score_watch_result(movie, title_text, text),
        "is_official": 0,
        "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def search_watch_links(pool: ExaPool, movie: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    title = movie.get("title") or movie.get("title_ar") or ""
    year = published_year(movie)
    watch_links: list[dict[str, Any]] = []

    for config in WATCH_PROVIDER_CONFIGS:
        provider_links: list[dict[str, Any]] = []
        for suffix in config["query_suffixes"]:
            query = f'"{title}" فيلم {year} {suffix}'.strip()
            try:
                response = pool.search(
                    query,
                    type="keyword",
                    num_results=max(limit * 2, 4),
                    include_domains=config["domains"],
                    contents={"text": {"max_characters": 300}},
                )
            except Exception:
                continue

            for result in response.results:
                item = build_watch_link(movie, result, config["provider_key"], config["platform"])
                if item:
                    provider_links.append(item)
                    if len(provider_links) >= limit:
                        break
            if provider_links:
                break

        watch_links.extend(dedupe_entries(provider_links, "url")[:limit])

    return dedupe_entries(watch_links, "url")[: max(limit * 2, limit)]


def youtube_fallback(movie: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    title = movie.get("title") or movie.get("title_ar") or ""
    year = published_year(movie)
    query = urllib.parse.quote_plus(f"{title} فيلم كامل {year}".strip())
    url = f"https://www.youtube.com/results?search_query={query}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    for video_id in YOUTUBE_RESULT_RE.findall(html):
        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        results.append(
            {
                "provider_key": "youtube",
                "platform": "YouTube",
                "url": watch_url,
                "title": f"{title} ({year})",
                "embed_type": "iframe",
                "embed_url": f"https://www.youtube.com/embed/{video_id}",
                "source_kind": "youtube-search",
                "confidence": 0.45,
                "is_official": 0,
                "verified_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        if len(results) >= limit:
            break
    return dedupe_entries(results, "url")


def should_process(movie: dict[str, Any], args: argparse.Namespace) -> bool:
    if args.movie_id and str(movie.get("id") or "") not in set(args.movie_id):
        return False
    if args.title_match:
        title = normalize_text(movie.get("title") or movie.get("title_ar") or "")
        if not any(normalize_text(item) in title for item in args.title_match):
            return False
    return True


def existing_enrichment_map(path: Path) -> dict[str, dict[str, Any]]:
    records = load_json(path, [])
    if isinstance(records, dict):
        return {str(key): value for key, value in records.items() if isinstance(value, dict)}
    if not isinstance(records, list):
        return {}
    return {
        str(item.get("movie_id")): item
        for item in records
        if isinstance(item, dict) and item.get("movie_id")
    }


def main() -> int:
    args = parse_args()
    pool = ExaPool.from_keys(exa_keys_from_env())

    input_path = Path(args.input)
    output_path = Path(args.output)
    movies = load_json(input_path, [])
    if not isinstance(movies, list):
        raise ValueError(f"{input_path} must contain a JSON array")

    existing = existing_enrichment_map(output_path)
    processed = 0

    for movie in movies:
        movie_id = str(movie.get("id") or "")
        if not movie_id:
            continue
        if movie_id in existing and not args.refresh_existing:
            continue
        if not should_process(movie, args):
            continue
        if processed >= args.max_movies:
            break

        title = movie.get("title") or movie_id
        print(f"[{processed + 1}/{args.max_movies}] Enriching {title}")

        watch_links = search_watch_links(pool, movie, args.max_watch_results)
        if not args.skip_youtube_fallback and not any(item.get("provider_key") == "youtube" for item in watch_links):
            watch_links.extend(youtube_fallback(movie, args.max_watch_results))
            watch_links = dedupe_entries(watch_links, "url")

        news = search_articles(pool, movie, "news", args.max_article_results)
        reviews = search_articles(pool, movie, "review", max(2, args.max_article_results // 2))

        record = {
            "movie_id": movie_id,
            "title": movie.get("title") or "",
            "year": str(movie.get("year") or ""),
            "watch_links": watch_links,
            "news": news,
            "reviews": reviews,
            "enriched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        existing[movie_id] = record
        processed += 1
        ordered_records = sorted(existing.values(), key=lambda item: str(item.get("movie_id") or ""))
        save_json_atomic(output_path, ordered_records)
        time.sleep(args.query_delay_seconds + random.uniform(0.0, 0.35))

    print(f"Saved {len(existing)} enrichment records to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
