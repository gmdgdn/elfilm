"""
HTTP client for fetching pages from Dhliz.
"""

import asyncio
import logging
import time
from typing import Optional
import httpx

from .config import (
    BASE_URL,
    BASE_URL_EN,
    USER_AGENT,
    REQUEST_TIMEOUT,
    MAX_RETRIES,
    RETRY_BACKOFF,
)

logger = logging.getLogger(__name__)


class DhlizClient:
    """Client for fetching and interacting with Dhliz website."""

    def __init__(self, max_retries: int = MAX_RETRIES):
        """Initialize the Dhliz client.

        Args:
            max_retries: Maximum number of retries for transient failures.
        """
        self.max_retries = max_retries
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0",
        }

    async def fetch_year_page(self, year: int) -> Optional[str]:
        """Fetch the HTML for a year's films listing page.

        Args:
            year: The production year to fetch films for.

        Returns:
            The HTML content if successful, None otherwise.
        """
        url = f"{BASE_URL}/search?query={year}&section=years"
        return await self._fetch_with_retry(url, f"year {year}")

    async def fetch_film_page(self, slug: str, lang: str = "en") -> Optional[str]:
        """Fetch the HTML for a film detail page.

        Args:
            slug: The film slug, e.g. 'aakher_kedba'.
            lang: Language code ('en' or 'ar').

        Returns:
            The HTML content if successful, None otherwise.
        """
        if lang == "ar":
            url = f"{BASE_URL}/film/{slug}/"
        else:
            url = f"{BASE_URL_EN}/film/{slug}/"

        return await self._fetch_with_retry(url, f"film {slug} ({lang})")

    async def fetch_film_about_page(self, slug: str) -> Optional[str]:
        """Fetch the HTML for a film's full data/about page.

        Args:
            slug: The film slug, e.g. 'aakher_kedba'.

        Returns:
            The HTML content if successful, None otherwise.
        """
        url = f"{BASE_URL_EN}/film/{slug}/about"
        return await self._fetch_with_retry(url, f"film about {slug}")

    async def _fetch_with_retry(
        self, url: str, description: str = ""
    ) -> Optional[str]:
        """Fetch a URL with retry logic.

        Args:
            url: URL to fetch.
            description: Human-readable description for logging.

        Returns:
            The HTML content if successful, None otherwise.
        """
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(
                    headers=self.headers,
                    timeout=REQUEST_TIMEOUT,
                    follow_redirects=True,
                ) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    logger.debug(f"Fetched {description}: {url}")
                    # Small delay to be respectful
                    await asyncio.sleep(0.5)
                    return response.text

            except httpx.HTTPStatusError as e:
                if e.response.status_code in [429, 503]:
                    # Rate limited or service unavailable, retry with backoff
                    if attempt < self.max_retries - 1:
                        wait_time = RETRY_BACKOFF ** attempt
                        logger.warning(
                            f"Rate limited/unavailable ({description}), "
                            f"retrying in {wait_time}s..."
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(
                            f"Failed to fetch {description} after {self.max_retries} "
                            f"attempts: {e.response.status_code}"
                        )
                        return None
                elif e.response.status_code == 404:
                    logger.warning(f"Not found: {description}")
                    return None
                else:
                    logger.error(
                        f"HTTP error fetching {description}: {e.response.status_code}"
                    )
                    return None

            except (httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < self.max_retries - 1:
                    wait_time = RETRY_BACKOFF ** attempt
                    logger.warning(
                        f"Connection error ({description}), "
                        f"retrying in {wait_time}s..."
                    )
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Failed to connect to {description}: {e}")
                    return None

            except Exception as e:
                logger.error(f"Unexpected error fetching {description}: {e}")
                return None

        return None
