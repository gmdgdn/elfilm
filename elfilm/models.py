"""
Data models for ElFilm using Pydantic.
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CastMember(BaseModel):
    """Represents a cast member in a film."""
    name: str
    rating: Optional[float] = None

    class Config:
        """Pydantic config."""
        frozen = False


class Film(BaseModel):
    """Represents a film in the ElFilm dataset."""

    slug: str = Field(..., description="Film slug, e.g. 'aakher_kedba'")
    urls: Dict[str, str] = Field(..., description="URLs for film pages")
    title_en: str = Field(..., description="English title")
    title_ar: Optional[str] = Field(None, description="Arabic title")
    production_year: int = Field(..., description="Production year")
    type: Optional[str] = Field(None, description="Film type, e.g. 'Black and White'")
    duration_minutes: Optional[int] = Field(None, description="Duration in minutes")
    genres_en: List[str] = Field(default_factory=list, description="English genre list")
    summary_ar: Optional[str] = Field(None, description="Arabic plot summary")
    crew: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Crew by role, e.g. {'screenwriter_en': ['Name'], ...}"
    )
    cast_en: List[CastMember] = Field(default_factory=list, description="English cast list")
    tags_en: List[str] = Field(default_factory=list, description="English tags")
    tags_ar: List[str] = Field(default_factory=list, description="Arabic tags")

    class Config:
        """Pydantic config."""
        frozen = False

    def to_dict(self) -> Dict:
        """Convert Film to a dictionary suitable for JSON serialization."""
        return self.model_dump(exclude_none=False)


class ElFilmDataset(BaseModel):
    """Represents the entire ElFilm dataset grouped by year."""

    films_by_year: Dict[str, List[Film]] = Field(
        default_factory=dict,
        description="Films grouped by production year"
    )

    class Config:
        """Pydantic config."""
        frozen = False

    def to_dict(self) -> Dict:
        """Convert dataset to a dictionary suitable for JSON serialization."""
        result = {}
        for year, films in self.films_by_year.items():
            result[year] = [film.model_dump() for film in films]
        return result
