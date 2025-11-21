"""
Storage functions for saving ElFilm datasets.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List

from .models import Film

logger = logging.getLogger(__name__)


def save_json(films_by_year: Dict[str, List[Film]], output_path: Path) -> None:
    """Save the ElFilm dataset to a JSON file.

    Args:
        films_by_year: Dictionary mapping year strings to lists of Film objects.
        output_path: Path where the JSON file will be saved.
    """
    try:
        # Convert Film objects to dicts
        data = {}
        for year, films in films_by_year.items():
            data[year] = [film.model_dump() for film in films]

        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Write JSON with UTF-8 and pretty printing
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                data,
                f,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )

        logger.info(f"Saved ElFilm dataset to {output_path}")
        logger.info(f"Total films: {sum(len(films) for films in films_by_year.values())}")

    except Exception as e:
        logger.error(f"Error saving JSON to {output_path}: {e}")
        raise


def load_json(json_path: Path) -> Dict[str, List[Dict]]:
    """Load an ElFilm dataset from a JSON file.

    Args:
        json_path: Path to the JSON file.

    Returns:
        Dictionary mapping year strings to lists of film dictionaries.
    """
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        logger.info(f"Loaded ElFilm dataset from {json_path}")
        return data

    except Exception as e:
        logger.error(f"Error loading JSON from {json_path}: {e}")
        raise


def validate_dataset(films_by_year: Dict[str, List[Film]]) -> bool:
    """Validate the ElFilm dataset for basic invariants.

    Args:
        films_by_year: The dataset to validate.

    Returns:
        True if validation passes, False otherwise.
    """
    issues = []

    for year_str, films in films_by_year.items():
        try:
            year_int = int(year_str)
        except ValueError:
            issues.append(f"Invalid year key: {year_str}")
            continue

        # Check for duplicates
        slugs = set()
        for film in films:
            if not film.slug:
                issues.append(f"Film in {year_str} has empty slug")
            elif film.slug in slugs:
                issues.append(f"Duplicate slug {film.slug} in {year_str}")
            else:
                slugs.add(film.slug)

            # Check that production_year matches the year
            if film.production_year != year_int:
                issues.append(
                    f"Film {film.slug} has production_year {film.production_year} "
                    f"but is in year {year_int}"
                )

    if issues:
        for issue in issues:
            logger.warning(f"Validation issue: {issue}")
        return False

    return True
