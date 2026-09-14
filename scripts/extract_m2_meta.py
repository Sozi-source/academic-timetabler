import re
import json

with open('src/features/teaching-documents/curriculum-data/module-2.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's find each key block
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
    # extract block
    pattern = rf'"{k}":\s*\{{(.*?)\n  \}}'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        block = match.group(1)
        name = re.search(r'"unitName":\s*"([^"]+)"', block)
        code = re.search(r'"syllabusCode":\s*"([^"]+)"', block)
        nom = re.search(r'"nominalHours":\s*(\d+)', block)
        th = re.search(r'"theoryHours":\s*(\d+)', block)
        pr = re.search(r'"practicalHours":\s*(\d+)', block)
        aliases = re.search(r'"aliases":\s*(\[[^\]]+\])', block)
        print(f"Key: {k}")
        print(f"  Name: {name.group(1) if name else 'N/A'}")
        print(f"  Code: {code.group(1) if code else 'N/A'}")
        print(f"  Nominal: {nom.group(1) if nom else 'N/A'}, Theory: {th.group(1) if th else 'N/A'}, Prac: {pr.group(1) if pr else 'N/A'}")
        print(f"  Aliases: {aliases.group(1) if aliases else 'N/A'}")
