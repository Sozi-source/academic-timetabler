import os
import re

# Let's search all migrations or local files first
def search_local():
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in root or '.git' in root or '.next' in root:
            continue
        for file in files:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    if 'agricultural' in content.lower():
                        print(f"Match in {filepath}")
                        for line in content.splitlines():
                            if 'agricultural' in line.lower():
                                print(f"  {line.strip()[:120]}")
            except Exception:
                pass

search_local()
