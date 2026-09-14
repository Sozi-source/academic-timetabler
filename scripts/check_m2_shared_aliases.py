import re

with open('src/features/teaching-documents/curriculum-data/shared-map.ts', 'r', encoding='utf-8') as f:
    text = f.read()

keys = [
    'intro_microbiology',
    'diet_therapy_ii',
    'food_processing_preservation',
    'intro_biostatistics',
    'basic_biochemistry',
    'nutrition_in_lifespan',
    'nutrition_and_behaviour',
    'primary_health_care',
    'first_aid',
    'business_plan',
    'research_methods',
    'industrial_attachment_ii',
]

for k in keys:
    # find all mappings where value is k
    matches = re.findall(rf'"([^"]+)":\s*"{k}"', text)
    print(f"Key {k} has {len(matches)} aliases in shared-map: {matches[:10]}")
