#!/usr/bin/env python3
"""
ElFilm Data Analysis Script
- Find duplicates in movies and people
- Create clean lists of Egyptian movies and people
"""

import json
from collections import defaultdict
from pathlib import Path
import re

def normalize_title(title):
    """Normalize Arabic title for comparison"""
    if not title:
        return ""
    # Remove common variations and extra whitespace
    title = title.strip()
    title = re.sub(r'\s+', ' ', title)
    # Normalize Arabic characters
    title = title.replace('ى', 'ي')
    title = title.replace('ة', 'ه')
    title = title.replace('أ', 'ا')
    title = title.replace('إ', 'ا')
    title = title.replace('آ', 'ا')
    return title.lower()

def load_json(filepath):
    """Load JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return []

def analyze_movies():
    """Analyze movies for duplicates"""
    print("=" * 60)
    print("MOVIES ANALYSIS")
    print("=" * 60)
    
    # Load all movie sources
    movies_master = load_json('movies_master.json')
    movies_unified = load_json('movies_unified.json')
    elcinema_details = load_json('elcinema_movies_details.json')
    
    print(f"\n📊 Data Sources:")
    print(f"  - movies_master.json: {len(movies_master)} movies")
    print(f"  - movies_unified.json: {len(movies_unified)} movies")
    print(f"  - elcinema_movies_details.json: {len(elcinema_details)} movies")
    
    # Use master as primary source
    movies = movies_master if movies_master else movies_unified
    
    # Find duplicates by exact title
    title_groups = defaultdict(list)
    for movie in movies:
        title = movie.get('title', '')
        if title:
            title_groups[title].append(movie)
    
    exact_duplicates = {k: v for k, v in title_groups.items() if len(v) > 1}
    
    # Find duplicates by normalized title
    normalized_groups = defaultdict(list)
    for movie in movies:
        title = movie.get('title', '')
        if title:
            norm_title = normalize_title(title)
            normalized_groups[norm_title].append(movie)
    
    normalized_duplicates = {k: v for k, v in normalized_groups.items() if len(v) > 1}
    
    # Find duplicates by title + year
    title_year_groups = defaultdict(list)
    for movie in movies:
        title = movie.get('title', '')
        year = movie.get('year', '')
        if title:
            key = f"{normalize_title(title)}_{year}"
            title_year_groups[key].append(movie)
    
    title_year_duplicates = {k: v for k, v in title_year_groups.items() if len(v) > 1}
    
    # Find duplicates by ID
    id_groups = defaultdict(list)
    for movie in movies:
        movie_id = movie.get('id', '')
        if movie_id:
            id_groups[movie_id].append(movie)
    
    id_duplicates = {k: v for k, v in id_groups.items() if len(v) > 1}
    
    print(f"\n🔍 Duplicate Analysis:")
    print(f"  - Exact title duplicates: {len(exact_duplicates)} groups")
    print(f"  - Normalized title duplicates: {len(normalized_duplicates)} groups")
    print(f"  - Title+Year duplicates: {len(title_year_duplicates)} groups")
    print(f"  - ID duplicates: {len(id_duplicates)} groups")
    
    # Show sample duplicates
    print(f"\n📝 Sample Exact Title Duplicates (first 10):")
    for i, (title, dups) in enumerate(list(exact_duplicates.items())[:10]):
        years = [d.get('year', '?') for d in dups]
        sources = [d.get('source', '?') for d in dups]
        print(f"  {i+1}. '{title}' - Years: {years}, Sources: {sources}")
    
    return {
        'total_movies': len(movies),
        'exact_duplicates': len(exact_duplicates),
        'normalized_duplicates': len(normalized_duplicates),
        'title_year_duplicates': len(title_year_duplicates),
        'id_duplicates': len(id_duplicates),
        'duplicate_titles': list(exact_duplicates.keys())[:50],
        'movies_data': movies
    }

def analyze_people():
    """Analyze people for duplicates"""
    print("\n" + "=" * 60)
    print("PEOPLE ANALYSIS")
    print("=" * 60)
    
    # Load people data
    people_master = load_json('people_master.json')
    people_exa = load_json('people_exa_enriched.json')
    people_details = load_json('people_details.json')
    
    # Use best available
    people = people_master if people_master else people_exa if people_exa else people_details
    
    print(f"\n📊 Data Sources:")
    print(f"  - people_master.json: {len(people_master)} people")
    print(f"  - people_exa_enriched.json: {len(people_exa)} people")
    print(f"  - people_details.json: {len(people_details)} people")
    
    # Find duplicates by name
    name_groups = defaultdict(list)
    for person in people:
        name = person.get('name', '') or person.get('name_ar', '')
        if name:
            name_groups[name].append(person)
    
    name_duplicates = {k: v for k, v in name_groups.items() if len(v) > 1}
    
    # Find duplicates by ID
    id_groups = defaultdict(list)
    for person in people:
        person_id = person.get('id', '')
        if person_id:
            id_groups[person_id].append(person)
    
    id_duplicates = {k: v for k, v in id_groups.items() if len(v) > 1}
    
    print(f"\n🔍 Duplicate Analysis:")
    print(f"  - Name duplicates: {len(name_duplicates)} groups")
    print(f"  - ID duplicates: {len(id_duplicates)} groups")
    
    # Show sample duplicates
    if name_duplicates:
        print(f"\n📝 Sample Name Duplicates (first 10):")
        for i, (name, dups) in enumerate(list(name_duplicates.items())[:10]):
            ids = [d.get('id', '?') for d in dups]
            print(f"  {i+1}. '{name}' - IDs: {ids}")
    
    return {
        'total_people': len(people),
        'name_duplicates': len(name_duplicates),
        'id_duplicates': len(id_duplicates),
        'duplicate_names': list(name_duplicates.keys())[:50],
        'people_data': people
    }

def create_clean_egyptian_movies(movies_data):
    """Create deduplicated list of Egyptian movies"""
    print("\n" + "=" * 60)
    print("CREATING CLEAN EGYPTIAN MOVIES LIST")
    print("=" * 60)
    
    # Deduplicate by title + year (keeping richest entry)
    seen = {}
    for movie in movies_data:
        title = movie.get('title', '')
        year = movie.get('year', '')
        key = f"{normalize_title(title)}_{year}"
        
        if key not in seen:
            seen[key] = movie
        else:
            # Keep the one with more data
            existing = seen[key]
            existing_score = sum([
                1 if existing.get('story') else 0,
                1 if existing.get('poster_url') and 'blank' not in existing.get('poster_url', '') else 0,
                len(existing.get('cast', [])),
                len(existing.get('crew', [])),
                len(existing.get('genres', [])),
                len(existing.get('news', [])),
                len(existing.get('reviews', []))
            ])
            new_score = sum([
                1 if movie.get('story') else 0,
                1 if movie.get('poster_url') and 'blank' not in movie.get('poster_url', '') else 0,
                len(movie.get('cast', [])),
                len(movie.get('crew', [])),
                len(movie.get('genres', [])),
                len(movie.get('news', [])),
                len(movie.get('reviews', []))
            ])
            if new_score > existing_score:
                seen[key] = movie
    
    # Filter Egyptian movies (based on source - dhliz and elcinema are Egyptian-focused)
    egyptian_movies = []
    for movie in seen.values():
        source = movie.get('source', '')
        url = movie.get('url', '')
        
        # All movies from these sources are Egyptian/Arabic
        is_egyptian = (
            source in ['dhliz', 'elcinema'] or
            'dhliz.com' in url or
            'elcinema.com' in url
        )
        
        if is_egyptian:
            # Clean up the movie entry
            clean_movie = {
                'id': movie.get('id', ''),
                'title': movie.get('title', ''),
                'year': movie.get('year', ''),
                'poster_url': movie.get('poster_url', ''),
                'story': movie.get('story', ''),
                'genres': list(set(movie.get('genres', []))),  # Remove duplicate genres
                'duration': movie.get('duration', ''),
                'rating': movie.get('rating', ''),
                'cast': movie.get('cast', []),
                'crew': movie.get('crew', []),
                'source': source,
                'url': url,
                'watch_links': movie.get('watch_links', []),
                'news': movie.get('news', [])[:5],  # Keep top 5 news
                'reviews': movie.get('reviews', [])[:5]  # Keep top 5 reviews
            }
            egyptian_movies.append(clean_movie)
    
    # Sort by year (descending) then title
    egyptian_movies.sort(key=lambda x: (-(int(x['year']) if x['year'].isdigit() else 0), x['title']))
    
    print(f"\n✅ Results:")
    print(f"  - Total unique Egyptian movies: {len(egyptian_movies)}")
    
    # Year distribution
    year_counts = defaultdict(int)
    for m in egyptian_movies:
        year = m.get('year', 'Unknown')
        year_counts[year] += 1
    
    print(f"\n📅 Movies by Decade:")
    decades = defaultdict(int)
    for year, count in year_counts.items():
        if year.isdigit():
            decade = (int(year) // 10) * 10
            decades[decade] += count
    
    for decade in sorted(decades.keys()):
        print(f"  {decade}s: {decades[decade]} movies")
    
    # Save clean list
    with open('egyptian_movies_clean.json', 'w', encoding='utf-8') as f:
        json.dump(egyptian_movies, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Saved: egyptian_movies_clean.json")
    
    return egyptian_movies

def create_clean_egyptian_people(people_data):
    """Create deduplicated list of Egyptian cinema people"""
    print("\n" + "=" * 60)
    print("CREATING CLEAN EGYPTIAN PEOPLE LIST")
    print("=" * 60)
    
    # Deduplicate by ID
    seen = {}
    for person in people_data:
        person_id = person.get('id', '')
        if not person_id:
            continue
            
        if person_id not in seen:
            seen[person_id] = person
        else:
            # Merge data if duplicate
            existing = seen[person_id]
            for key in ['bio_search', 'news', 'awards_search']:
                if person.get(key) and not existing.get(key):
                    existing[key] = person[key]
    
    # Clean up people entries
    egyptian_people = []
    for person in seen.values():
        clean_person = {
            'id': person.get('id', ''),
            'name_ar': person.get('name_ar', '') or person.get('name', ''),
            'name_en': person.get('name_en', ''),
            'birthdate': person.get('birthdate', ''),
            'years_active': person.get('years_active', ''),
            'profile_image': person.get('profile_image', '') or person.get('image_url', ''),
            'movies': person.get('movies', []),
            'type': person.get('type', 'person'),
            'bio': person.get('bio_search', [])[:3],  # Top 3 bio links
            'news': person.get('news', [])[:3],  # Top 3 news
            'awards': person.get('awards_search', [])[:3]  # Top 3 awards
        }
        egyptian_people.append(clean_person)
    
    # Sort by number of movies (descending), then name
    egyptian_people.sort(key=lambda x: (-len(x.get('movies', [])), x.get('name_ar', '')))
    
    print(f"\n✅ Results:")
    print(f"  - Total unique Egyptian cinema people: {len(egyptian_people)}")
    
    # Show top 20 by filmography
    print(f"\n🌟 Top 20 by Number of Movies:")
    for i, person in enumerate(egyptian_people[:20]):
        name = person.get('name_ar', '') or person.get('name_en', '')
        num_movies = len(person.get('movies', []))
        print(f"  {i+1}. {name} - {num_movies} movies")
    
    # Save clean list
    with open('egyptian_people_clean.json', 'w', encoding='utf-8') as f:
        json.dump(egyptian_people, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Saved: egyptian_people_clean.json")
    
    return egyptian_people

def generate_summary_report(movies_analysis, people_analysis, clean_movies, clean_people):
    """Generate final summary report"""
    print("\n" + "=" * 60)
    print("FINAL SUMMARY REPORT")
    print("=" * 60)
    
    report = {
        'generated': str(Path('.').resolve()),
        'movies': {
            'total_raw': movies_analysis['total_movies'],
            'exact_duplicates_found': movies_analysis['exact_duplicates'],
            'normalized_duplicates_found': movies_analysis['normalized_duplicates'],
            'title_year_duplicates_found': movies_analysis['title_year_duplicates'],
            'total_clean_egyptian': len(clean_movies),
            'duplicates_removed': movies_analysis['total_movies'] - len(clean_movies)
        },
        'people': {
            'total_raw': people_analysis['total_people'],
            'name_duplicates_found': people_analysis['name_duplicates'],
            'id_duplicates_found': people_analysis['id_duplicates'],
            'total_clean_egyptian': len(clean_people)
        },
        'sample_duplicate_titles': movies_analysis['duplicate_titles'][:20],
        'sample_duplicate_names': people_analysis['duplicate_names'][:20]
    }
    
    # Save report
    with open('data_analysis_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"\n📊 MOVIES:")
    print(f"  - Raw data: {report['movies']['total_raw']} entries")
    print(f"  - Duplicates removed: {report['movies']['duplicates_removed']}")
    print(f"  - Clean Egyptian movies: {report['movies']['total_clean_egyptian']}")
    
    print(f"\n👥 PEOPLE:")
    print(f"  - Raw data: {report['people']['total_raw']} entries")
    print(f"  - Clean Egyptian people: {report['people']['total_clean_egyptian']}")
    
    print(f"\n💾 Report saved: data_analysis_report.json")
    
    return report

def main():
    print("🎬 ElFilm Data Analysis")
    print("=" * 60)
    
    # Analyze movies
    movies_analysis = analyze_movies()
    
    # Analyze people
    people_analysis = analyze_people()
    
    # Create clean lists
    clean_movies = create_clean_egyptian_movies(movies_analysis['movies_data'])
    clean_people = create_clean_egyptian_people(people_analysis['people_data'])
    
    # Generate report
    report = generate_summary_report(movies_analysis, people_analysis, clean_movies, clean_people)
    
    print("\n" + "=" * 60)
    print("✅ ANALYSIS COMPLETE!")
    print("=" * 60)
    print("\nOutput files:")
    print("  - egyptian_movies_clean.json")
    print("  - egyptian_people_clean.json")
    print("  - data_analysis_report.json")

if __name__ == '__main__':
    main()
