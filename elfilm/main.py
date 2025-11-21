"""
Main entry point for the ElFilm scraper.
"""

import asyncio
import logging
import sys
from typing import Dict, List, Optional

from .config import START_YEAR, END_YEAR, MAX_CONCURRENT_REQUESTS, get_json_output_path, LOG_LEVEL
from .dhliz_client import DhlizClient
from .models import Film
from .parsers import (
    parse_year_page,
    parse_english_film_page,
    parse_arabic_film_page,
)
from .store import save_json, validate_dataset

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


class ElFilmScraper:
    """Main scraper orchestrator for ElFilm dataset."""

    def __init__(self, start_year: int = START_YEAR, end_year: int = END_YEAR):
        """Initialize the scraper.

        Args:
            start_year: Starting production year (inclusive).
            end_year: Ending production year (inclusive).
        """
        self.start_year = start_year
        self.end_year = end_year
        self.client = DhlizClient()
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async def scrape_all(self) -> Dict[str, List[Film]]:
        """Scrape all films for the configured year range.

        Returns:
            Dictionary mapping year strings to lists of Film objects.
        """
        films_by_year: Dict[str, List[Film]] = {}

        for year in range(self.start_year, self.end_year + 1):
            logger.info(f"Scraping year {year}...")

            try:
                films = await self.scrape_year(year)
                if films:
                    year_str = str(year)
                    films_by_year[year_str] = films
                    logger.info(f"Year {year}: found {len(films)} films")
                else:
                    logger.warning(f"Year {year}: no films found")

            except Exception as e:
                logger.error(f"Error scraping year {year}: {e}")
                continue

        return films_by_year

    async def scrape_year(self, year: int) -> List[Film]:
        """Scrape all films for a specific year.

        Args:
            year: The production year to scrape.

        Returns:
            List of Film objects for that year.
        """
        # Fetch year page
        year_html = await self.client.fetch_year_page(year)
        if not year_html:
            logger.warning(f"Could not fetch year page for {year}")
            return []

        # Parse film slugs
        slugs = parse_year_page(year_html, year)
        if not slugs:
            logger.warning(f"No film slugs found for year {year}")
            return []

        logger.info(f"Found {len(slugs)} film slugs for year {year}")

        # Scrape each film
        films = []
        tasks = [self.scrape_film(slug, year) for slug in slugs]

        # Run with semaphore to limit concurrency
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Error scraping film: {result}")
            elif result:
                films.append(result)

        return films

    async def scrape_film(self, slug: str, year: int) -> Optional[Film]:
        """Scrape a single film using both English and Arabic pages.

        Args:
            slug: The film slug.
            year: The production year (for validation).

        Returns:
            A Film object if successful, None otherwise.
        """
        async with self.semaphore:
            try:
                # Fetch pages
                en_html = await self.client.fetch_film_page(slug, lang="en")
                ar_html = await self.client.fetch_film_page(slug, lang="ar")

                if not en_html:
                    logger.warning(f"Could not fetch English page for {slug}")
                    return None

                # Parse English page
                en_data = parse_english_film_page(en_html, slug)
                if not en_data:
                    logger.warning(f"Could not parse English page for {slug}")
                    return None

                # Parse Arabic page
                ar_data = {}
                if ar_html:
                    ar_data = parse_arabic_film_page(ar_html, slug) or {}

                # Merge data into Film object
                film = Film(
                    slug=slug,
                    urls={
                        "film_page_en": f"https://dhliz.com/en/film/{slug}/",
                        "film_page_ar": f"https://dhliz.com/film/{slug}/",
                    },
                    title_en=en_data.get("title_en", ""),
                    title_ar=en_data.get("title_ar") or ar_data.get("title_ar"),
                    production_year=en_data.get("production_year", year),
                    type=en_data.get("type"),
                    duration_minutes=en_data.get("duration_minutes"),
                    genres_en=en_data.get("genres_en", []),
                    summary_ar=ar_data.get("summary_ar"),
                    crew=en_data.get("crew", {}),
                    cast_en=en_data.get("cast_en", []),
                    tags_en=en_data.get("tags_en", []),
                    tags_ar=ar_data.get("tags_ar", []),
                )

                logger.debug(f"Successfully scraped film: {slug}")
                return film

            except Exception as e:
                logger.error(f"Error scraping film {slug}: {e}")
                return None


async def main(
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
    output_path: Optional[str] = None,
) -> None:
    """Main entry point for the scraper.

    Args:
        start_year: Starting year (uses config default if None).
        end_year: Ending year (uses config default if None).
        output_path: Output file path (uses config default if None).
    """
    start = start_year or START_YEAR
    end = end_year or END_YEAR
    out_path = output_path or get_json_output_path()

    logger.info(f"Starting ElFilm scraper for years {start}{end}")
    logger.info(f"Output will be saved to: {out_path}")

    scraper = ElFilmScraper(start_year=start, end_year=end)

    # Scrape all films
    films_by_year = await scraper.scrape_all()

    if not films_by_year:
        logger.error("No films were scraped!")
        sys.exit(1)

    # Validate dataset
    logger.info("Validating dataset...")
    if not validate_dataset(films_by_year):
        logger.warning("Dataset validation found issues (see above)")

    # Save to JSON
    logger.info(f"Saving {sum(len(f) for f in films_by_year.values())} films to JSON...")
    save_json(films_by_year, out_path)

    logger.info(" ElFilm scraper completed successfully!")


if __name__ == "__main__":
    # Check for CLI arguments
    import sys

    start_year = None
    end_year = None
    output_path = None

    if len(sys.argv) > 1:
        try:
            start_year = int(sys.argv[1])
        except ValueError:
            logger.error(f"Invalid start year: {sys.argv[1]}")
            sys.exit(1)

    if len(sys.argv) > 2:
        try:
            end_year = int(sys.argv[2])
        except ValueError:
            logger.error(f"Invalid end year: {sys.argv[2]}")
            sys.exit(1)

    if len(sys.argv) > 3:
        output_path = sys.argv[3]

    asyncio.run(main(start_year=start_year, end_year=end_year, output_path=output_path))
