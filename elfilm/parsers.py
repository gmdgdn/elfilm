"""
HTML parsers for extracting data from Dhliz pages.
"""

import logging
import re
from typing import List, Dict, Optional, Set
from bs4 import BeautifulSoup

from .models import Film, CastMember

logger = logging.getLogger(__name__)


def parse_year_page(html: str, year: int) -> List[str]:
    """Parse the year listing page and extract film slugs.

    Args:
        html: The HTML content of the year page.
        year: The year being parsed (used for validation).

    Returns:
        List of film slugs found on the page.
    """
    soup = BeautifulSoup(html, "lxml")
    slugs = []
    seen = set()

    # Find all <a> tags where:
    # 1. href starts with /film/
    # 2. Text ends with (YEAR)
    year_pattern = f"({year})"

    all_links = soup.find_all("a")

    for link in all_links:
        href = link.get("href", "")
        text = link.get_text(strip=True)

        # Check if this is a film link
        if href.startswith("/film/") and year_pattern in text and text.endswith(year_pattern):
            # Extract slug from href: /film/slug/ -> slug
            slug = href.strip("/").replace("film/", "").strip("/")

            # Avoid duplicates
            if slug and slug not in seen:
                slugs.append(slug)
                seen.add(slug)
                logger.debug(f"Found film slug for {year}: {slug}")

    logger.info(f"Parsed {len(slugs)} films from year {year}")
    return slugs


def parse_english_film_page(html: str, slug: str) -> Optional[Dict]:
    """Parse the English film detail page.

    Args:
        html: The HTML content of the English film page.
        slug: The film slug (for context).

    Returns:
        Dictionary with parsed film metadata, or None if parsing fails.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        data = {}

        # Extract title_en - usually in an <h1> or similar heading
        title_en_elem = soup.find("h1")
        if not title_en_elem:
            # Fallback: look for the first large text element
            title_en_elem = soup.find(["h1", "h2"])
        data["title_en"] = (
            title_en_elem.get_text(strip=True) if title_en_elem else ""
        )

        # Extract title_ar - usually appears right below title_en
        # Look for text containing Arabic characters
        title_ar = None
        text_elements = soup.find_all(["h2", "h3", "p"], limit=20)
        for elem in text_elements:
            text = elem.get_text(strip=True)
            if text and _contains_arabic(text):
                title_ar = text
                break
        data["title_ar"] = title_ar

        # Extract metadata from "about" section
        # Look for lines like "Production year: 1950", "Duration: 115 minutes", etc.
        page_text = soup.get_text()

        production_year = _extract_production_year(page_text)
        data["production_year"] = production_year

        film_type = _extract_film_type(page_text)
        data["type"] = film_type

        duration = _extract_duration(page_text)
        data["duration_minutes"] = duration

        # Extract genres
        genres = _extract_genres(page_text)
        data["genres_en"] = genres

        # Extract crew
        crew = _extract_crew(soup)
        data["crew"] = crew

        # Extract cast
        cast = _extract_cast(soup)
        data["cast_en"] = cast

        # Extract tags
        tags = _extract_tags_en(soup)
        data["tags_en"] = tags

        logger.debug(f"Parsed English film page for {slug}")
        return data

    except Exception as e:
        logger.error(f"Error parsing English film page for {slug}: {e}")
        return None


def parse_arabic_film_page(html: str, slug: str) -> Optional[Dict]:
    """Parse the Arabic film detail page.

    Args:
        html: The HTML content of the Arabic film page.
        slug: The film slug (for context).

    Returns:
        Dictionary with parsed Arabic-specific metadata.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        data = {}

        # Extract summary_ar - look for "'DB5):" followed by text
        summary_ar = None
        page_text = soup.get_text()

        # Find the paragraph after "القصة:"
        summary_match = re.search(
            r"القصة:\s*(.+?)(?:\n\n|$)", page_text, re.DOTALL
        )
        if summary_match:
            summary_ar = summary_match.group(1).strip()
        data["summary_ar"] = summary_ar

        # Extract tags_ar - look for section with "3E'*"
        tags_ar = _extract_tags_ar(soup)
        data["tags_ar"] = tags_ar

        logger.debug(f"Parsed Arabic film page for {slug}")
        return data

    except Exception as e:
        logger.error(f"Error parsing Arabic film page for {slug}: {e}")
        return {"summary_ar": None, "tags_ar": []}


def parse_english_about_page(html: str, slug: str) -> Optional[Dict]:
    """Parse the English about/full data page.

    Args:
        html: The HTML content of the about page.
        slug: The film slug (for context).

    Returns:
        Dictionary with extended crew data.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        data = {}

        # Extract extended crew roles
        crew = _extract_crew(soup)
        data["crew"] = crew

        logger.debug(f"Parsed English about page for {slug}")
        return data

    except Exception as e:
        logger.error(f"Error parsing English about page for {slug}: {e}")
        return None


# Helper functions

def _contains_arabic(text: str) -> bool:
    """Check if text contains Arabic characters."""
    arabic_pattern = re.compile(r"[\u0600-\u06FF]")
    return bool(arabic_pattern.search(text))


def _extract_production_year(text: str) -> Optional[int]:
    """Extract production year from text."""
    match = re.search(r"Production year:\s*(\d{4})", text)
    if match:
        return int(match.group(1))
    return None


def _extract_film_type(text: str) -> Optional[str]:
    """Extract film type (e.g., 'Black and White', 'Color')."""
    match = re.search(r"Type:\s*([^\n]+)", text)
    if match:
        return match.group(1).strip()
    return None


def _extract_duration(text: str) -> Optional[int]:
    """Extract duration in minutes."""
    match = re.search(r"Duration:\s*(\d+)\s*minutes?", text)
    if match:
        return int(match.group(1))
    return None


def _extract_genres(text: str) -> List[str]:
    """Extract genres from text."""
    genres = []
    match = re.search(r"Genre\(s\):\s*([^\n]+)", text)
    if match:
        genre_str = match.group(1).strip()
        # Split by comma or dash
        parts = re.split(r"[,-]", genre_str)
        genres = [g.strip() for g in parts if g.strip()]
    return genres


def _extract_crew(soup: BeautifulSoup) -> Dict[str, List[str]]:
    """Extract crew information from the page."""
    crew = {}

    # Map of role names to dictionary keys
    role_mapping = {
        "Screenwriter": "screenwriter_en",
        "Screenplay": "screenplay_en",
        "Dialogue": "dialogue_en",
        "Producer": "producer_en",
        "Director": "director_en",
        "Assistant Director": "assistant_director_en",
        "Photography": "photography_en",
        "Art Director": "art_director_en",
        "Music": "music_en",
        "Montage": "montage_en",
        "Makeup": "makeup_en",
        "Sound": "sound_en",
    }

    page_text = soup.get_text()

    for role_name, key in role_mapping.items():
        # Look for the role followed by names
        # Common pattern: "Role: Name1, Name2, Name3"
        pattern = f"{role_name}:?\\s*([^\\n]+)"
        match = re.search(pattern, page_text, re.IGNORECASE)
        if match:
            names_str = match.group(1).strip()
            # Split by comma
            names = [n.strip() for n in names_str.split(",") if n.strip()]
            if names:
                crew[key] = names

    return crew


def _extract_cast(soup: BeautifulSoup) -> List[CastMember]:
    """Extract cast information from the page."""
    cast = []

    # Look for cast sections - typically marked or in a specific area
    # Try to find links that represent cast members

    page_text = soup.get_text()

    # Look for sections labeled "Cast" or "Actors"
    # Extract text patterns like "Name (Rating)" or just "Name"

    # A simple heuristic: find all links in the main content
    # This is a basic approach; the actual page structure may vary

    links = soup.find_all("a")
    seen_names = set()

    for link in links:
        text = link.get_text(strip=True)
        # Skip non-person names (too short, has special chars, etc.)
        if len(text) < 3 or not _is_person_name(text):
            continue

        # Extract rating if present (usually before or after the name)
        rating = None
        match = re.search(r"(\d+\.?\d*)", text)
        if match:
            try:
                rating = float(match.group(1))
                # Remove rating from name text
                name_text = re.sub(r"\d+\.?\d*", "", text).strip()
            except ValueError:
                name_text = text
        else:
            name_text = text

        if name_text and name_text not in seen_names:
            cast.append(CastMember(name=name_text, rating=rating))
            seen_names.add(name_text)

    return cast


def _extract_tags_en(soup: BeautifulSoup) -> List[str]:
    """Extract English tags from the page."""
    tags = []

    page_text = soup.get_text()

    # Look for "Tags (N)" section
    match = re.search(r"Tags\s*\(\d+\):\s*(.+?)(?=\n\n|\Z)", page_text)
    if match:
        tags_str = match.group(1).strip()
        # Split by comma
        parts = [t.strip() for t in tags_str.split(",") if t.strip()]
        tags = parts

    return tags


def _extract_tags_ar(soup: BeautifulSoup) -> List[str]:
    """Extract Arabic tags from the page."""
    tags = []

    page_text = soup.get_text()

    # Look for "سمات" section
    match = re.search(r"سمات\s*(?:\(\d+\))?:\s*(.+?)(?:\n\n|$)", page_text)
    if match:
        tags_str = match.group(1).strip()
        # Split by comma
        parts = [t.strip() for t in tags_str.split(",") if t.strip()]
        tags = parts

    return tags


def _is_person_name(text: str) -> bool:
    """Check if text looks like a person name."""
    # Simple heuristic: contains mostly letters and spaces
    if not text:
        return False

    # Remove common rating/special characters
    cleaned = re.sub(r"[\d.,]", "", text).strip()

    # Should have at least 2 characters
    if len(cleaned) < 2:
        return False

    # Should be mostly letters and spaces
    letter_count = sum(1 for c in cleaned if c.isalpha() or c.isspace())
    return letter_count / len(cleaned) > 0.7
