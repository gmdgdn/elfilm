"""
Comprehensive data audit script to:
1. Load legacy spreadsheet
2. Compare with current datasets
3. Identify missing films
4. Plan data merge
"""
import pandas as pd
import json
import os
from collections import defaultdict

# Load all datasets
print("=" * 60)
print("LOADING ALL DATASETS")
print("=" * 60)

# 1. Load legacy spreadsheet
legacy_csv = "قائمة الأفلام - Sheet1.csv"
legacy_xlsx = "قائمة الأفلام.xlsx"

if os.path.exists(legacy_csv):
    print(f"\n✅ Found: {legacy_csv}")
    legacy_df = pd.read_csv(legacy_csv, encoding='utf-8-sig')
    print(f"   Columns: {list(legacy_df.columns)}")
    print(f"   Rows: {len(legacy_df)}")
elif os.path.exists(legacy_xlsx):
    print(f"\n✅ Found: {legacy_xlsx}")
    legacy_df = pd.read_excel(legacy_xlsx)
    print(f"   Columns: {list(legacy_df.columns)}")
    print(f"   Rows: {len(legacy_df)}")
else:
    print(f"\n❌ Legacy file not found!")
    legacy_df = None

# 2. Load current datasets
datasets = {
    'movies_unified.json': None,
    'movies_exa_enriched_full.json': None,
    'people_exa_enriched.json': None,
    'elcinema_movies_details.json': None,
    'elcinema_movies_list.json': None
}

for filename in datasets.keys():
    if os.path.exists(filename):
        with open(filename, 'r', encoding='utf-8') as f:
            datasets[filename] = json.load(f)
            print(f"\n✅ {filename}: {len(datasets[filename])} entries")
    else:
        print(f"\n❌ {filename}: NOT FOUND")

print("\n" + "=" * 60)
print("DATA AUDIT SUMMARY")
print("=" * 60)

# Extract movie titles from each dataset
all_titles = defaultdict(set)

if datasets['movies_unified.json']:
    for movie in datasets['movies_unified.json']:
        title = movie.get('title', '')
        if title:
            all_titles['unified'].add(title.strip())

if datasets['movies_exa_enriched_full.json']:
    for movie in datasets['movies_exa_enriched_full.json']:
        title = movie.get('title', '')
        if title:
            all_titles['exa_enriched'].add(title.strip())

if datasets['elcinema_movies_details.json']:
    for movie in datasets['elcinema_movies_details.json']:
        title = movie.get('title', '')
        if title:
            all_titles['elcinema_details'].add(title.strip())

if datasets['elcinema_movies_list.json']:
    for movie in datasets['elcinema_movies_list.json']:
        title = movie.get('title', '')
        if title:
            all_titles['elcinema_list'].add(title.strip())

if legacy_df is not None:
    # Find title column
    title_col = None
    for col in legacy_df.columns:
        if 'اسم' in col or 'عنوان' in col or 'الفيلم' in col or 'title' in col.lower():
            title_col = col
            break
    
    if title_col:
        print(f"\n📋 Legacy file title column: {title_col}")
        legacy_titles = set(legacy_df[title_col].dropna().astype(str).str.strip())
        all_titles['legacy'] = legacy_titles
        print(f"   Legacy titles: {len(legacy_titles)}")
    else:
        print(f"\n⚠️ Could not identify title column in legacy file")
        print(f"   Available columns: {list(legacy_df.columns)}")

# Compare datasets
print("\n" + "=" * 60)
print("TITLE COUNTS PER DATASET")
print("=" * 60)
for dataset_name, titles in all_titles.items():
    print(f"{dataset_name:25} {len(titles):5} unique titles")

# Find missing titles
if 'legacy' in all_titles and 'unified' in all_titles:
    missing_in_unified = all_titles['legacy'] - all_titles['unified']
    print("\n" + "=" * 60)
    print(f"MISSING TITLES: {len(missing_in_unified)} movies from legacy NOT in unified")
    print("=" * 60)
    
    if missing_in_unified:
        print("\nFirst 20 missing titles:")
        for i, title in enumerate(sorted(list(missing_in_unified))[:20], 1):
            print(f"{i:3}. {title}")
        
        # Save full list
        with open('missing_titles.txt', 'w', encoding='utf-8') as f:
            for title in sorted(missing_in_unified):
                f.write(f"{title}\n")
        print(f"\n✅ Full list saved to: missing_titles.txt")

# Check enrichment completeness
print("\n" + "=" * 60)
print("ENRICHMENT COMPLETENESS")
print("=" * 60)

if datasets['movies_unified.json'] and datasets['movies_exa_enriched_full.json']:
    unified_titles = all_titles['unified']
    exa_titles = all_titles['exa_enriched']
    
    not_enriched = unified_titles - exa_titles
    print(f"\n✅ Unified movies: {len(unified_titles)}")
    print(f"✅ Exa enriched: {len(exa_titles)}")
    print(f"⚠️ Not enriched: {len(not_enriched)}")
    
    if not_enriched:
        print(f"\nMovies without Exa enrichment (first 10):")
        for i, title in enumerate(sorted(list(not_enriched))[:10], 1):
            print(f"{i:3}. {title}")

# Save audit report
print("\n" + "=" * 60)
print("GENERATING AUDIT REPORT")
print("=" * 60)

report = {
    "audit_date": "2025-11-22 10:56",
    "datasets": {
        name: len(data) if data else 0 
        for name, data in datasets.items()
    },
    "title_counts": {
        name: len(titles) 
        for name, titles in all_titles.items()
    },
    "missing_from_unified": len(missing_in_unified) if 'legacy' in all_titles else 0,
    "not_exa_enriched": len(not_enriched) if 'unified' in all_titles and 'exa_enriched' in all_titles else 0
}

with open('data_audit_report.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print("\n✅ Audit report saved to: data_audit_report.json")
print("\n" + "=" * 60)
print("AUDIT COMPLETE")
print("=" * 60)
