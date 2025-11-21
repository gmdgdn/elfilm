# ElFilm - Egyptian Film Database Scraper

A robust, asynchronous web scraper for extracting comprehensive metadata about Egyptian films from the [Dhliz.com](https://dhliz.com) database.

## Overview

ElFilm scrapes Egyptian films from Dhliz, extracting structured data including:

- **Film metadata**: Title (English & Arabic), production year, type, duration
- **Crew information**: Directors, screenwriters, producers, cinematographers, and more
- **Cast**: Actor names with ratings
- **Descriptions**: Arabic plot summaries
- **Tags**: Film categorization in both English and Arabic

## Project Structure

```
elfilm/
├── __init__.py              # Package initialization
├── config.py                # Configuration and constants
├── models.py                # Pydantic data models
├── dhliz_client.py          # HTTP client with retry logic
├── parsers.py               # HTML parsing utilities
├── store.py                 # JSON storage and validation
├── main.py                  # Main scraper orchestrator
└── demo_data.py             # Sample HTML for testing

test_demo.py                 # Comprehensive test suite
output/                      # JSON output directory (created automatically)
requirements.txt             # Python dependencies
```

## Installation

### Prerequisites
- Python 3.8+

### Setup

```bash
# Clone the repository
cd elfilm

# Install dependencies
pip install -r requirements.txt
```

## Dependencies

- **httpx** (0.25.2): Async HTTP client with built-in retries
- **beautifulsoup4** (4.12.2): HTML parsing
- **lxml** (4.9.3): XML/HTML processing backend
- **pydantic** (2.5.0): Data validation and modeling

## Configuration

Edit `elfilm/config.py` to adjust:

### Year Range
```python
START_YEAR = 1950  # Starting production year
END_YEAR = 1960    # Ending production year
```

Or set via environment variables:
```bash
export START_YEAR=1950
export END_YEAR=2000
```

### Other Settings
- `MAX_CONCURRENT_REQUESTS`: Max simultaneous HTTP requests (default: 5)
- `REQUEST_TIMEOUT`: Timeout per request in seconds (default: 30)
- `MAX_RETRIES`: Retries for transient failures (default: 3)
- `LOG_LEVEL`: Logging level (default: "INFO")

## Usage

### Basic Usage

Scrape films from 1950–1960:

```bash
python -m elfilm.main
```

### Custom Year Range

```bash
# Scrape 1950–1960
python -m elfilm.main 1950 1960

# Scrape single year
python -m elfilm.main 1950 1950
```

### Custom Output Path

```bash
python -m elfilm.main 1950 1960 /path/to/output.json
```

### Test with Demo Data

To test the parsing logic without hitting Dhliz:

```bash
python test_demo.py
```

This runs comprehensive tests on sample HTML and demonstrates:
- Year page parsing
- English film page parsing
- Arabic film page parsing
- Film object creation

## Output Format

The scraper generates a JSON file (e.g., `output/elfilm_1950_1960.json`) with this structure:

```json
{
  "1950": [
    {
      "slug": "aakher_kedba",
      "urls": {
        "film_page_en": "https://dhliz.com/en/film/aakher_kedba/",
        "film_page_ar": "https://dhliz.com/film/aakher_kedba/"
      },
      "title_en": "Aakher Kedba",
      "title_ar": "آخر كدبة",
      "production_year": 1950,
      "type": "Black and White",
      "duration_minutes": 115,
      "genres_en": ["Comedy"],
      "summary_ar": "فيلم كوميدي مصري...",
      "crew": {
        "screenwriter_en": ["Abo-Al-Seoud Al-Ibiary"],
        "screenplay_en": ["Ahmad Badrakhan"],
        "dialogue_en": ["Abo-Al-Seoud Al-Ibiary"],
        "producer_en": ["Farid Al-Atrash Films"],
        "director_en": ["Ahmad Badrakhan"]
      },
      "cast_en": [
        {"name": "Farid Al-Atrash", "rating": 8.0},
        {"name": "Samya Gamal", "rating": null},
        {"name": "Ismail Yassine", "rating": 7.0}
      ],
      "tags_en": ["marriage", "male singer", "female dancer"],
      "tags_ar": ["زواج", "مطرب", "راقصة"]
    },
    ...
  ],
  "1951": [
    ...
  ]
}
```

## Data Models

### Film

Core film object with the following fields:

- `slug` (str): Film slug for constructing URLs
- `urls` (dict): Links to English and Arabic film pages
- `title_en` (str): English title
- `title_ar` (str | None): Arabic title
- `production_year` (int): Year of production
- `type` (str | None): Film type (e.g., "Black and White", "Color")
- `duration_minutes` (int | None): Duration in minutes
- `genres_en` (list): English genre tags
- `summary_ar` (str | None): Arabic plot summary
- `crew` (dict): Crew by role (screenwriter, director, producer, etc.)
- `cast_en` (list): Cast members with optional ratings
- `tags_en` (list): English thematic tags
- `tags_ar` (list): Arabic thematic tags

### CastMember

- `name` (str): Actor name
- `rating` (float | None): IMDb-style rating (if available)

## Architecture

### Async Design

The scraper uses Python's `asyncio` for concurrent HTTP requests:

- **Semaphore-based concurrency**: Limits simultaneous requests to respect server resources
- **Configurable delays**: Small delays between requests to be respectful

### Retry Logic

Handles transient failures gracefully:

- Exponential backoff for rate limiting (429) and service unavailable (503)
- Logs permanent failures (404) and continues processing
- Configurable retry count and backoff multiplier

### HTML Parsing

Uses BeautifulSoup with lxml backend for robust HTML parsing:

- Extracts structured data from loosely-formatted HTML
- Handles both English and Arabic content
- Graceful fallbacks for missing fields

## Logging

The scraper provides detailed logging:

```bash
# Run with DEBUG logging
LOG_LEVEL=DEBUG python -m elfilm.main 1950 1950
```

Log levels:
- `DEBUG`: HTTP requests, detailed parsing
- `INFO`: Year progress, film counts, completion
- `WARNING`: Missing or incomplete data
- `ERROR`: Failures and exceptions

## Extension & Future Work

The codebase is designed for easy extension:

### Adding New Fields

1. Update `Film` model in `models.py`
2. Add extraction logic in `parsers.py`
3. Update test data in `demo_data.py`

### Database Storage

Helper function in `store.py` can be extended to support:

- SQLite database with schema
- PostgreSQL/Convex integration
- Elasticsearch indexing

### Extended Crew Data

The about-page parser (`parse_english_about_page`) provides access to:

- Assistant director
- Cinematography
- Art direction
- Music composition
- Sound engineering
- Makeup

### Batch Processing

The ETL pipeline can be modified to:

- Resume from interrupted year ranges
- Incremental updates
- Parallel year processing

## Ethical Considerations

This scraper is designed to be respectful:

- **Rate limiting**: Configurable concurrency and delays
- **User-Agent**: Identifies itself as a legitimate client
- **robots.txt compliance**: Respects server directives
- **Error handling**: Skips unavailable content gracefully

Please respect Dhliz's terms of service when using this scraper.

## Development

### Running Tests

```bash
# Run demo tests
python test_demo.py

# Run specific parser test
python -c "from test_demo import test_parse_year; test_parse_year()"
```

### Code Style

The project follows:
- PEP 8 naming conventions
- Type hints for all functions
- Docstrings for all modules and functions
- Clear separation of concerns

## Troubleshooting

### 403 Forbidden Errors

If you encounter 403 errors when accessing Dhliz:

1. Check your internet connection
2. Verify Dhliz is accessible from your location
3. Try increasing `REQUEST_TIMEOUT` in config
4. Use a VPN if the site blocks your region
5. Check if you're being rate limited (try reducing `MAX_CONCURRENT_REQUESTS`)

### Missing Data

Some films may have incomplete metadata:

- `title_ar` might be None if not available on English page
- `summary_ar` only appears on Arabic pages
- Cast ratings are optional

### Memory Usage

For large year ranges, JSON output can be several MB:

- Consider breaking into smaller year ranges
- Stream to database instead of keeping in memory
- Use database output format for production

## License

This project is provided as-is for educational and research purposes.

## Contributing

Improvements and suggestions are welcome! Areas for contribution:

- Better HTML parsing heuristics
- Database storage backend
- CLI improvements
- Additional metadata extraction

## References

- [Dhliz.com](https://dhliz.com) - Egyptian Film Database
- [BeautifulSoup Documentation](https://www.crummy.com/software/BeautifulSoup/bs4/doc/)
- [httpx Documentation](https://www.python-httpx.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
