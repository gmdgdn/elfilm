"""Canonical source registry for Egyptian cinema enrichment."""

from __future__ import annotations

import urllib.parse
from typing import Any


SOURCE_REGISTRY: dict[str, dict[str, Any]] = {
    "elcinema.com": {
        "kind": "canonical_movie_people_database",
        "trusted_for": ["movies", "people", "cast", "crew", "images", "synopsis"],
        "embed": False,
        "notes": "Best spine for Egyptian movie/person identities and bios.",
    },
    "filfan.com": {
        "kind": "editorial_news_reviews",
        "trusted_for": ["news", "reviews", "interviews", "context"],
        "embed": False,
        "notes": "Strong Arabic entertainment newsroom and article coverage.",
    },
    "aljazeera.net": {
        "kind": "editorial_context",
        "trusted_for": ["analysis", "history", "context", "profiles"],
        "embed": False,
        "notes": "Useful for long-form cultural/editorial context.",
    },
    "elgounafilmfestival.com": {
        "kind": "festival_metadata",
        "trusted_for": ["festival_selection", "synopsis", "cast", "crew", "trailers", "company"],
        "embed": False,
        "notes": "Good for festival-level film pages and structured credits.",
    },
    "youtube.com": {
        "kind": "video_platform",
        "trusted_for": ["trailers", "clips", "embeds"],
        "embed": True,
        "notes": "Best public embed source when uploader is official or clearly licensed.",
    },
    "youtu.be": {
        "kind": "video_platform",
        "trusted_for": ["trailers", "clips", "embeds"],
        "embed": True,
        "notes": "Short link variant of YouTube.",
    },
    "dailymotion.com": {
        "kind": "video_platform",
        "trusted_for": ["trailers", "clips", "embeds"],
        "embed": True,
        "notes": "Useful alternative embed source for trailers/clips.",
    },
    "ok.ru": {
        "kind": "video_platform",
        "trusted_for": ["availability_candidate"],
        "embed": False,
        "notes": "Preserve as external availability candidate only; avoid auto-embedding.",
    },
    "justwatch.com": {
        "kind": "availability_aggregator",
        "trusted_for": ["where_to_watch", "provider", "region"],
        "embed": False,
        "notes": "Best model for structured watch availability and provider normalization.",
    },
}

BLOCKED_ARTICLE_DOMAIN_FRAGMENTS = (
    "wikipedia",
    "themoviedb",
    "tmdb",
    "3rabica",
    "areq",
    "larozza",
    "downvod",
    "marefa",
    "dweb.link",
)


def normalize_host(url_or_host: str) -> str:
    host = urllib.parse.urlparse(url_or_host).netloc or url_or_host
    return host.lower().replace("www.", "")


def domain_root(url_or_host: str) -> str:
    host = normalize_host(url_or_host)
    if host.startswith("m."):
        return host[2:]
    return host


def source_record(url_or_host: str) -> dict[str, Any]:
    host = domain_root(url_or_host)
    for registry_host, meta in SOURCE_REGISTRY.items():
        registry_norm = domain_root(registry_host)
        if host == registry_norm or host.endswith("." + registry_norm):
            record = dict(meta)
            record["domain"] = registry_host
            return record
    return {
        "domain": host,
        "kind": "unknown",
        "trusted_for": [],
        "embed": False,
        "notes": "",
    }


def is_blocked_article_domain(url_or_host: str) -> bool:
    host = domain_root(url_or_host)
    if any(fragment in host for fragment in BLOCKED_ARTICLE_DOMAIN_FRAGMENTS):
        return True
    return source_record(host).get("kind") == "availability_candidate"


def is_trusted_embed_source(url_or_host: str) -> bool:
    return bool(source_record(url_or_host).get("embed"))

