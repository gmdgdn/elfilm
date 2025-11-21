"""
ElFilm - Scraper for Egyptian films from Dhliz.
"""

from .models import Film, CastMember, ElFilmDataset
from .main import ElFilmScraper, main

__all__ = [
    "Film",
    "CastMember",
    "ElFilmDataset",
    "ElFilmScraper",
    "main",
]
