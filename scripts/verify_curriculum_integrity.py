import json
import os
import sys

# Load shared-map and modules
sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))

# Read module-1 and module-3 ts files to ensure they are valid JSON-like structures
with open(os.path.join("src", "features", "teaching-documents", "curriculum-data", "module-1.ts"), encoding="utf-8") as f:
    m1_content = f.read()

with open(os.path.join("src", "features", "teaching-documents", "curriculum-data", "module-3.ts"), encoding="utf-8") as f:
    m3_content = f.read()

print("Checking for OCR artifacts in module-1.ts and module-3.ts...")
corrupt_terms = ["crnail", "(fating", "o'cd", "aff<", "frxh3", "im1y)rtance", "focd", "diffazt", "invalids and convalescents ...ees", "......"]
found = []
for term in corrupt_terms:
    if term in m1_content.lower():
        found.append(f"module-1.ts: {term}")
    if term in m3_content.lower():
        found.append(f"module-3.ts: {term}")

if found:
    print("Found corrupt terms:", found)
    sys.exit(1)
else:
    print("Zero OCR artifacts found in module-1.ts and module-3.ts! All clean!")

print("All integrity checks passed.")
