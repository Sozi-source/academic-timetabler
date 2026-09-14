import re

with open('src/features/teaching-documents/curriculum-data/module-2.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Match entries
matches = re.findall(r'"([a-zA-Z0-9_]+)":\s*\{\s*"canonicalKey":\s*"([^"]+)",\s*"syllabusCode":\s*"([^"]+)",\s*"unitCode":\s*"([^"]+)",\s*"unitName":\s*"([^"]+)"', text)
print(f"Total units matched: {len(matches)}")
for m in matches:
    print(f"- key: {m[0]}, code: {m[2]}, name: {m[4]}")
