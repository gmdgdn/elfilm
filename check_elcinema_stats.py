import json

with open('elcinema_movies_list.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f'Total movies: {len(data)}')
print(f'With titles: {len([m for m in data if m.get("title")])}')

years = [m.get('year', '') for m in data if m.get('year')]
if years:
    print(f'Years range: {min(years)}-{max(years)}')
