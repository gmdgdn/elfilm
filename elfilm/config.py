"""
Configuration and constants for the ElFilm scraper.
"""

import os
from pathlib import Path

# Base URLs
BASE_URL = "https://dhliz.com"
BASE_URL_EN = "https://dhliz.com/en"

# Year range for scraping
START_YEAR = int(os.getenv("START_YEAR", 1950))
END_YEAR = int(os.getenv("END_YEAR", 1960))

# Concurrency settings
MAX_CONCURRENT_REQUESTS = 5
REQUEST_TIMEOUT = 30.0

# Retry settings
MAX_RETRIES = 3
RETRY_BACKOFF = 2.0  # exponential backoff multiplier

# User agent
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Output paths
OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

def get_json_output_path() -> Path:
    """Get the path where JSON output will be saved."""
    return OUTPUT_DIR / f"elfilm_{START_YEAR}_{END_YEAR}.json"

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
