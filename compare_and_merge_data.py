#!/usr/bin/env python3
"""
Compare and merge Egyptian cinema data from multiple sources:
1. Existing scraped data (movies_master.json, people_master.json)
2. CSV file (قائمة الأفلام - Sheet1.csv)
3. Wikipedia actors list
"""

import json
import csv
import re
from collections import defaultdict
from pathlib import Path

def normalize_title(title):
    """Normalize Arabic title for comparison"""
    if not title:
        return ""
    title = title.strip()
    title = re.sub(r'\s+', ' ', title)
    # Normalize Arabic characters
    title = title.replace('ى', 'ي')
    title = title.replace('ة', 'ه')
    title = title.replace('أ', 'ا')
    title = title.replace('إ', 'ا')
    title = title.replace('آ', 'ا')
    title = title.replace('ؤ', 'و')
    title = title.replace('ئ', 'ي')
    # Remove common prefixes/suffixes
    title = re.sub(r'^ال', '', title)
    return title.lower().strip()

def load_json(filepath):
    """Load JSON file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return []

def load_csv_movies(filepath):
    """Load movies from CSV file"""
    movies = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                movie = {
                    'id': row.get('الرقم', ''),
                    'title': row.get('الفيلم', ''),
                    'year': row.get('سنة الإنتاج', ''),
                    'director': row.get('المخرج', ''),
                    'country': row.get('البلد', ''),
                    'source': 'csv_list'
                }
                movies.append(movie)
    except Exception as e:
        print(f"Error loading CSV: {e}")
    return movies

def parse_wikipedia_actors(text_chunks):
    """Parse actor names from Wikipedia text chunks"""
    actors = []
    for chunk in text_chunks:
        # Extract names from markdown list items
        lines = chunk.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('- '):
                # Extract name from list item
                name = line[2:].strip()
                # Remove wiki links
                name = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', name)
                # Remove parenthetical info
                name = re.sub(r'\([^)]*\)', '', name).strip()
                if name and len(name) > 1:
                    actors.append({
                        'name_ar': name,
                        'source': 'wikipedia'
                    })
    return actors

def compare_movies():
    """Compare movies from all sources"""
    print("=" * 60)
    print("MOVIES COMPARISON")
    print("=" * 60)
    
    # Load existing scraped data
    existing_movies = load_json('movies_master.json')
    if not existing_movies:
        existing_movies = load_json('egyptian_movies_clean.json')
    
    # Load CSV movies
    csv_movies = load_csv_movies('قائمة الأفلام - Sheet1.csv')
    
    # Filter Egyptian movies from CSV
    csv_egyptian = [m for m in csv_movies if m.get('country') == 'مصر']
    
    print(f"\n📊 Source Data:")
    print(f"  - Existing scraped: {len(existing_movies)} movies")
    print(f"  - CSV total: {len(csv_movies)} movies")
    print(f"  - CSV Egyptian only: {len(csv_egyptian)} movies")
    
    # Create normalized title index for existing movies
    existing_index = {}
    existing_title_year = {}
    for movie in existing_movies:
        title = movie.get('title', '')
        year = movie.get('year', '')
        norm_title = normalize_title(title)
        if norm_title:
            if norm_title not in existing_index:
                existing_index[norm_title] = []
            existing_index[norm_title].append(movie)
            key = f"{norm_title}_{year}"
            existing_title_year[key] = movie
    
    # Find matches and missing
    matched = []
    missing_in_scraped = []
    
    for csv_movie in csv_egyptian:
        title = csv_movie.get('title', '')
        year = csv_movie.get('year', '')
        norm_title = normalize_title(title)
        
        # Check exact title+year match first
        key = f"{norm_title}_{year}"
        if key in existing_title_year:
            matched.append({
                'csv': csv_movie,
                'scraped': existing_title_year[key],
                'match_type': 'exact'
            })
        elif norm_title in existing_index:
            matched.append({
                'csv': csv_movie,
                'scraped': existing_index[norm_title][0],
                'match_type': 'title_only'
            })
        else:
            missing_in_scraped.append(csv_movie)
    
    # Find movies in scraped but not in CSV
    csv_index = {}
    for movie in csv_egyptian:
        norm_title = normalize_title(movie.get('title', ''))
        year = movie.get('year', '')
        key = f"{norm_title}_{year}"
        csv_index[key] = movie
        if norm_title not in csv_index:
            csv_index[norm_title] = movie
    
    missing_in_csv = []
    for movie in existing_movies:
        title = movie.get('title', '')
        year = movie.get('year', '')
        norm_title = normalize_title(title)
        key = f"{norm_title}_{year}"
        if key not in csv_index and norm_title not in csv_index:
            missing_in_csv.append(movie)
    
    print(f"\n🔍 Comparison Results:")
    print(f"  - Matched movies: {len(matched)}")
    print(f"  - CSV movies missing in scraped: {len(missing_in_scraped)}")
    print(f"  - Scraped movies not in CSV: {len(missing_in_csv)}")
    
    # Year distribution of missing
    missing_years = defaultdict(int)
    for m in missing_in_scraped:
        year = m.get('year', 'Unknown')
        missing_years[year] += 1
    
    print(f"\n📅 Missing movies by year (sample):")
    sorted_years = sorted(missing_years.items(), key=lambda x: -x[1])[:10]
    for year, count in sorted_years:
        print(f"  {year}: {count} movies")
    
    # Sample missing movies
    print(f"\n📝 Sample missing movies from CSV (first 20):")
    for i, movie in enumerate(missing_in_scraped[:20]):
        print(f"  {i+1}. {movie['title']} ({movie['year']}) - Dir: {movie['director']}")
    
    return {
        'matched': len(matched),
        'missing_in_scraped': missing_in_scraped,
        'missing_in_csv': len(missing_in_csv),
        'csv_total': len(csv_egyptian)
    }

def compare_people():
    """Compare people from existing data with Wikipedia list"""
    print("\n" + "=" * 60)
    print("PEOPLE COMPARISON")
    print("=" * 60)
    
    # Load existing people
    existing_people = load_json('people_master.json')
    if not existing_people:
        existing_people = load_json('egyptian_people_clean.json')
    
    # Wikipedia actors (extracted from chunk data - comprehensive list)
    wikipedia_actors_raw = """
إبراهيم إسماعيل,إبراهيم الأبيض,إبراهيم الجزار,إبراهيم الحجار,إبراهيم الحناوي,إبراهيم الخمسي,
إبراهيم الدالي,إبراهيم السمان,إبراهيم السيد,إبراهيم الشامي,إبراهيم الشرقاوي,إبراهيم المنياوي,
إبراهيم النحاس,إبراهيم الورداني,إبراهيم أنور,إبراهيم بشري,إبراهيم حامد,إبراهيم حجازي,
إبراهيم حسنين,إبراهيم حسين,إبراهيم حشمت,إبراهيم حمودة,إبراهيم خالد,إبراهيم خان,
إبراهيم ذو الفقار,إبراهيم رمزي,إبراهيم رمضان,إبراهيم زادة,إبراهيم سامي,إبراهيم سعفان,
إبراهيم سكر,إبراهيم سلام,إبراهيم صابر,إبراهيم صالح,إبراهيم صبحي,إبراهيم صبري,
إبراهيم صلاح,إبراهيم عباس,إبراهيم عبد الله,إبراهيم عبدالرازق,إبراهيم عبده,إبراهيم عتريس,
إبراهيم عرفة,إبراهيم عمارة,إبراهيم فاروق,إبراهيم فايق,إبراهيم فتيحة,إبراهيم فوزي,
إبراهيم قدري,إبراهيم لاما,إبراهيم منعم,إبراهيم نصر,إبراهيم يسري,أبو السعود عطية,
أبو الفتوح عمارة,أبو بكر عزت,أبو لمعة,ببا عز الدين,بثينة,بثينة حسن,بثينة رشوان,
بثينة سالم,بثينة عبد الغني السيد,بثينة عبدالنبي,بثينة علي,بثينة نصار,بدرية,بدرية السيد,
بدرية زايد,بدرية رأفت,بدرية طلبة,بدرية عبدالجواد,بديعة محمد صادق,بدرية محمود,بديعة صادق,
بديعة الصغير,بديعة مصابني,بديعة فوزي,برلنتي حسن,برلنتي عبد الحميد,برلنتي فؤاد,بسمة,
بسمة أحمد,بسمة حامد,بسمة شوقي,بسمة عمار,بسمة مجدي,بسمة محيي زايد,بسمة مصطفى,بسمة ياسر,
بسنت جمال,بشرى,بشرى القصبي,بهيجة حافظ,بهيجة حمدي,بهيجة رشدي,بهيجة المهدي,بهية حسن,بهير بدر,
بوسي,بوسي سمير,بوسي نصر,باسل جمال,باسم,باسم سمرة,باسم شريف,باسم عبد القهار,باسم محفوظ,
باسم يوسف,باهر سليم,باهر السيد,سارة,سارة توفيق,سالي,سالي جلال,سامية جمال,سامية حاتم,
سامية حسن,سامية رشدي,سامية شكري,سامية محسن,ساندي علي,سحر أنور,سحر حمدي,سحر رامي,
سرينا إبراهيم,سعاد ثروت,سعاد أحمد,سعاد حسني,سعاد حسين,سعاد فوزي,سعاد مكاوي,سعاد محمد,
سعاد نصر,سعيدة جلال,سلفانا بدرخان,سلمى غريب,سلوى بدر,سلوى توفيق,سلوى جلال,سلوى خطاب,
سلوى سعيد,سلوى عثمان,سلوى عزالدين,سلوى علام,سلوى محمد,سلوى محمد علي,سلوى محمود,سماء إبراهيم,
سماح أنور,سماح السعيد,سمر عطية,سميحة أيوب,سميحة توفيق,سميحة الطوخي,سميحة محمد,سميرة أحمد,
سميرة بارودي,سميرة توفيق,سميرة تيسير,سميرة خلوصي,سميرة صدقي,ماجد الكدواني,ماجد المصري,
ماجد ثابت,ماجد عبد العظيم,ماجدة الخطيب,ماجدة حمادة,ماجدة زكي,ماجدة صالح,ماجدة عنبر,
ماجدة نور الدين,ماجدة,ماجي,مادلين طبر,ماري باي باي,ماري عزالدين,ماري كويني,ماري منيب,
ماهر العطار,ماهر جمال,ماهر سليم,ماهر عصام,مايا توفيق,مايا شيحة,متولي علوان,مجدي إدريس,
مجدي إمام,مجدي بدر,مجدي بلال,مجدي توفيق,مجدي جميل,مجدي حافظ,مجدي حمزة,مجدي سعيد,
مجدي فكري,مجدي كامل,مجدي منير,مجدي وهبة,محاسن النجدي,محاسن جلال,محرم فؤاد,محروس حسن,
محسن الصفتي,محسن حافظ,محسن حسنين,محسن خيري,محسن زايد,محسن سرحان,محسن فكري,محسن محي الدين,
محسن منصور,محسنة توفيق,محمد الأنداني,محمد البزاوي,محمد البكار,محمد التابعي,محمد التاجي,
محمد التوني,ياسر جلال,ياسر حمزة,ياسر صادق,ياسر علي ماهر,ياسر فرج,ياسمين النجار,
ياسمين جمال,ياسمين حافظ,ياسمين صبري,ياسمين عبد العزيز,ياسين إسماعيل ياسين,يحيى الفخراني,
يحيى زكريا,يحيى شاهين,يسرا اللوزي,يسرا,يسري مصطفى,يسرية حافظ,يعقوب طانيوس,يعقوب ميخائيل,
يوسف الشريف,يوسف العسال,يوسف جلال,يوسف حافظ,يوسف داود,يوسف شاهين,يوسف شعبان,يوسف عثمان,
يوسف عوف,يوسف عيد,يوسف عيسى,يوسف فخر الدين,يوسف فوزي,يوسف منصور,يوسف وهبي,يونس شلبي,
محمود المليجي,فريد شوقي,عماد حمدي,توفيق الدقن,إسماعيل ياسين,صلاح نظمي,كمال الشناوي,
عبد الغني النجدي,وداد حمدي,عبد المنعم إبراهيم,نجوى فؤاد,ثريا فخري,عزيزة حلمي,
مريم فخر الدين,شكري سرحان,رشدي أباظة,حسن فايق,زينات صدقي,حسين رياض,سمير غانم,
أحمد السقا,عادل إمام,محمد هنيدي,أحمد حلمي,كريم عبد العزيز,أحمد عز,محمد رمضان,
منى زكي,ليلى علوي,نبيلة عبيد,نادية الجندي,إلهام شاهين,غادة عبد الرازق,هند صبري,
نيللي كريم,دنيا سمير غانم,رانيا يوسف,منة شلبي,درة,روبي,مي عز الدين,نور,
أمير كرارة,محمد إمام,أحمد فهمي,شيكو,هشام ماجد,بيومي فؤاد,محمد ثروت,أحمد آدم,
خالد الصاوي,فتحي عبدالوهاب,أحمد بدير,سيد رجب,محمد سلام,أشرف عبد الباقي,هاني رمزي,
علاء ولي الدين,أحمد زكي,نور الشريف,محمود عبد العزيز,فاروق الفيشاوي,أحمد مظهر,
صلاح ذو الفقار,حسين فهمي,محمود ياسين,أحمد رمزي,عمر الشريف,رشوان توفيق,حسن يوسف,
سهير رمزي,شهيرة,سهير البابلي,صفاء أبو السعود,فيفي عبده,لوسي,شريهان,سمية الخشاب,
غادة إبراهيم,ياسمين رئيس,نيرمين الفقي,صبا مبارك,حنان ترك,حلا شيحة,زينة,مي سليم,
آيتن عامر,دينا الشربيني,هنا الزاهد,جميلة عوض
    """
    
    # Parse Wikipedia actors
    wiki_actors = []
    for name in wikipedia_actors_raw.split(','):
        name = name.strip()
        if name:
            wiki_actors.append({'name_ar': name, 'source': 'wikipedia'})
    
    print(f"\n📊 Source Data:")
    print(f"  - Existing people: {len(existing_people)} people")
    print(f"  - Wikipedia actors list: {len(wiki_actors)} actors")
    
    # Create index of existing people
    existing_names = set()
    existing_index = {}
    for person in existing_people:
        name = person.get('name_ar', '') or person.get('name', '')
        norm_name = normalize_title(name)
        existing_names.add(norm_name)
        existing_index[norm_name] = person
    
    # Find matches and missing
    matched = []
    missing_in_scraped = []
    
    for actor in wiki_actors:
        name = actor.get('name_ar', '')
        norm_name = normalize_title(name)
        if norm_name in existing_names:
            matched.append({
                'wiki': actor,
                'scraped': existing_index.get(norm_name)
            })
        else:
            missing_in_scraped.append(actor)
    
    print(f"\n🔍 Comparison Results:")
    print(f"  - Matched actors: {len(matched)}")
    print(f"  - Wikipedia actors missing in scraped: {len(missing_in_scraped)}")
    
    # Sample missing
    print(f"\n📝 Sample missing actors from Wikipedia (first 30):")
    for i, actor in enumerate(missing_in_scraped[:30]):
        print(f"  {i+1}. {actor['name_ar']}")
    
    return {
        'matched': len(matched),
        'missing_in_scraped': missing_in_scraped,
        'wiki_total': len(wiki_actors)
    }

def create_merged_datasets(movies_comparison, people_comparison):
    """Create merged datasets with new entries"""
    print("\n" + "=" * 60)
    print("CREATING MERGED DATASETS")
    print("=" * 60)
    
    # Load existing data
    existing_movies = load_json('egyptian_movies_clean.json')
    existing_people = load_json('egyptian_people_clean.json')
    
    # Add missing movies from CSV
    new_movies = []
    for movie in movies_comparison['missing_in_scraped']:
        new_movie = {
            'id': f"csv_{movie.get('id', '')}",
            'title': movie.get('title', ''),
            'year': movie.get('year', ''),
            'director': movie.get('director', ''),
            'country': movie.get('country', ''),
            'source': 'csv_list',
            'poster_url': '',
            'story': '',
            'genres': [],
            'cast': [],
            'crew': [],
            'needs_enrichment': True
        }
        new_movies.append(new_movie)
    
    # Merge movies
    all_movies = existing_movies + new_movies
    all_movies.sort(key=lambda x: (-(int(x.get('year', '0')) if str(x.get('year', '0')).isdigit() else 0), x.get('title', '')))
    
    # Add missing people from Wikipedia
    new_people = []
    for person in people_comparison['missing_in_scraped']:
        new_person = {
            'id': normalize_title(person.get('name_ar', '')).replace(' ', '_'),
            'name_ar': person.get('name_ar', ''),
            'name_en': '',
            'source': 'wikipedia',
            'profile_image': '',
            'movies': [],
            'needs_enrichment': True
        }
        new_people.append(new_person)
    
    # Merge people
    all_people = existing_people + new_people
    
    print(f"\n✅ Merged Datasets:")
    print(f"  - Total movies: {len(all_movies)} (added {len(new_movies)} new)")
    print(f"  - Total people: {len(all_people)} (added {len(new_people)} new)")
    
    # Save merged datasets
    with open('egyptian_movies_merged.json', 'w', encoding='utf-8') as f:
        json.dump(all_movies, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Saved: egyptian_movies_merged.json")
    
    with open('egyptian_people_merged.json', 'w', encoding='utf-8') as f:
        json.dump(all_people, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved: egyptian_people_merged.json")
    
    # Save list of items needing enrichment
    movies_to_enrich = [m for m in all_movies if m.get('needs_enrichment')]
    people_to_enrich = [p for p in all_people if p.get('needs_enrichment')]
    
    with open('movies_needing_enrichment.json', 'w', encoding='utf-8') as f:
        json.dump(movies_to_enrich, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved: movies_needing_enrichment.json ({len(movies_to_enrich)} movies)")
    
    with open('people_needing_enrichment.json', 'w', encoding='utf-8') as f:
        json.dump(people_to_enrich, f, ensure_ascii=False, indent=2)
    print(f"💾 Saved: people_needing_enrichment.json ({len(people_to_enrich)} people)")
    
    return {
        'total_movies': len(all_movies),
        'new_movies': len(new_movies),
        'total_people': len(all_people),
        'new_people': len(new_people)
    }

def generate_final_report(movies_comp, people_comp, merged):
    """Generate final comparison report"""
    report = {
        'generated': 'compare_and_merge_data.py',
        'movies': {
            'existing_scraped': movies_comp['csv_total'] - len(movies_comp['missing_in_scraped']) + movies_comp['missing_in_csv'],
            'csv_egyptian': movies_comp['csv_total'],
            'matched': movies_comp['matched'],
            'missing_from_csv': len(movies_comp['missing_in_scraped']),
            'extra_in_scraped': movies_comp['missing_in_csv'],
            'total_merged': merged['total_movies'],
            'new_added': merged['new_movies']
        },
        'people': {
            'existing_scraped': people_comp['wiki_total'] - len(people_comp['missing_in_scraped']),
            'wikipedia_actors': people_comp['wiki_total'],
            'matched': people_comp['matched'],
            'missing_from_wiki': len(people_comp['missing_in_scraped']),
            'total_merged': merged['total_people'],
            'new_added': merged['new_people']
        }
    }
    
    with open('comparison_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print("FINAL COMPARISON REPORT")
    print("=" * 60)
    print(f"\n📊 MOVIES COVERAGE:")
    print(f"  - CSV Egyptian films list: {movies_comp['csv_total']} movies (1932-2006)")
    print(f"  - Already scraped from CSV: {movies_comp['matched']} movies")
    print(f"  - Missing from scraped data: {len(movies_comp['missing_in_scraped'])} movies")
    print(f"  - Additional in scraped (not in CSV): {movies_comp['missing_in_csv']} movies")
    print(f"  - TOTAL MERGED: {merged['total_movies']} movies")
    
    print(f"\n👥 PEOPLE COVERAGE:")
    print(f"  - Wikipedia Egyptian actors: {people_comp['wiki_total']} actors")
    print(f"  - Already in scraped data: {people_comp['matched']} actors")
    print(f"  - Missing from scraped: {len(people_comp['missing_in_scraped'])} actors")
    print(f"  - TOTAL MERGED: {merged['total_people']} people")
    
    coverage_movies = (movies_comp['matched'] / movies_comp['csv_total'] * 100) if movies_comp['csv_total'] > 0 else 0
    coverage_people = (people_comp['matched'] / people_comp['wiki_total'] * 100) if people_comp['wiki_total'] > 0 else 0
    
    print(f"\n📈 COVERAGE METRICS:")
    print(f"  - CSV Movies coverage: {coverage_movies:.1f}%")
    print(f"  - Wikipedia Actors coverage: {coverage_people:.1f}%")
    
    print(f"\n💾 Report saved: comparison_report.json")

def main():
    print("🎬 Egyptian Cinema Data Comparison & Merge")
    print("=" * 60)
    
    # Compare movies
    movies_comparison = compare_movies()
    
    # Compare people
    people_comparison = compare_people()
    
    # Create merged datasets
    merged = create_merged_datasets(movies_comparison, people_comparison)
    
    # Generate report
    generate_final_report(movies_comparison, people_comparison, merged)
    
    print("\n" + "=" * 60)
    print("✅ COMPARISON & MERGE COMPLETE!")
    print("=" * 60)

if __name__ == '__main__':
    main()
