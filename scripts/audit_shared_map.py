import re

with open('src/features/teaching-documents/curriculum-data/shared-map.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Extract all mappings from SHARED_UNIT_ALIAS_MAP
match = re.search(r'export const SHARED_UNIT_ALIAS_MAP: Record<string, string> = \{(.*?)\};', text, re.DOTALL)
if not match:
    print("Could not find SHARED_UNIT_ALIAS_MAP")
    exit(1)

map_body = match.group(1)
entries = re.findall(r'"([^"]+)":\s*"([^"]+)"', map_body)
print(f"Total entries: {len(entries)}")

# Look for entries where alias seems unrelated to the target key
unrelated = []
for alias, target in entries:
    # If alias is alphanumeric code like 'cnd1101', 'dnd1203', 'ccu1101', that's an institutional course code
    if re.match(r'^[a-z]{2,5}\d{3,5}[a-z]?$', alias):
        continue
    # Check title aliases
    target_clean = target.replace('_', '')
    if alias != target_clean and alias not in target_clean and target_clean not in alias:
        unrelated.append((alias, target))

print(f"\nPotential mismatches or non-obvious mappings ({len(unrelated)}):")
for a, t in unrelated:
    print(f"  '{a}' -> '{t}'")
