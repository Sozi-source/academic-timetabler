import zipfile
import xml.etree.ElementTree as ET
import os
import json

docx_path = "Diploma_Curriculum_Final_Structured.docx"

if not os.path.exists(docx_path):
    print("File not found:", docx_path)
    exit(1)

print(f"Opening {docx_path} ({os.path.getsize(docx_path)} bytes)...")

with zipfile.ZipFile(docx_path, 'r') as z:
    xml_content = z.read('word/document.xml')

root = ET.fromstring(xml_content)

namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
}

paragraphs = []
for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
    texts = [node.text for node in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if node.text]
    line = "".join(texts).strip()
    if line:
        paragraphs.append(line)

print(f"Total non-empty paragraphs: {len(paragraphs)}")

# Save all extracted raw text to a clean text file so we can view it directly
txt_out_path = "extracted_curriculum_raw.txt"
with open(txt_out_path, "w", encoding="utf-8") as f:
    for i, p in enumerate(paragraphs):
        f.write(f"{p}\n")

print(f"Wrote all extracted paragraphs to {txt_out_path} ({os.path.getsize(txt_out_path)} bytes)")

# Find unit headings or module titles
print("\n--- First 40 paragraphs ---")
for i, p in enumerate(paragraphs[:40]):
    print(f"{i+1}: {p}")
