"""Quick test of the improved search function"""
import sys
sys.path.insert(0, '.')

from enrich_all_movies import search_google
import json

# Test with a simple movie query
query = "مشاهدة فيلم السرب"
print(f"Testing query: {query}")
print("=" * 60)

results = search_google(query, num_results=3)

print(f"\nResults found: {len(results)}")
if results:
    print("\n✅ SUCCESS! Sample results:")
    for i, r in enumerate(results[:2], 1):
        print(f"\n{i}. {r['title']}")
        print(f"   URL: {r['link']}")
        if r['snippet']:
            print(f"   Snippet: {r['snippet'][:100]}...")
else:
    print("\n❌ FAILED - No results returned")
    print("Will need to use Firecrawl API as backup")
