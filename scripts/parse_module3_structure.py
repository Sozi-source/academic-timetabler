import re
import json

with open('module_3_extracted.md', encoding='utf-8') as f:
    text = f.read()

# Units start with: e.g. "34.3.0  Food Microbiology and Parasitology"
# Notice there is a unit listing at the top, then the unit sections
# Let's split on lines matching `^(\d+\.3\.0)\s+(.+)$`
lines = text.split('\n')

unit_indices = []
for i, line in enumerate(lines):
    m = re.match(r'^(\d+\.3\.0)\s+([A-Za-z].+)$', line.strip())
    if m:
        # Check if this is the header in the body (after line 17)
        if i >= 17:
            unit_indices.append((i, m.group(1), m.group(2).strip()))

print(f"Found {len(unit_indices)} unit sections in Module 3:")
for idx, code, title in unit_indices:
    print(f"  Line {idx}: {code} - {title}")

units = []
for k in range(len(unit_indices)):
    start_idx, code, title = unit_indices[k]
    end_idx = unit_indices[k+1][0] if k+1 < len(unit_indices) else len(lines)
    
    unit_lines = lines[start_idx:end_idx]
    
    # Description
    desc = ""
    objs = []
    topics = []
    
    state = None
    current_topic = None
    
    for l in unit_lines:
        ls = l.strip()
        if not ls or ls == f"{code}  {title}" or ls == f"{code} {title}":
            continue
        if ls.lower() == "description":
            state = "desc"
            continue
        elif ls.lower() in ["general objectives", "general objective"]:
            state = "objs"
            continue
        elif ls.lower() in ["topics and sub-topics", "topics and subtopics"]:
            state = "topics"
            continue
            
        if state == "desc":
            if not desc:
                desc = ls
            else:
                desc += " " + ls
        elif state == "objs":
            objs.append(ls.lstrip('-•* '))
        elif state == "topics":
            # Check for sub-module unit code e.g. "34.3.01  Introduction to..."
            tm = re.match(r'^(\d+\.3\.\d+)\s+(.+)$', ls)
            if tm:
                current_topic = {
                    'sub_code': tm.group(1),
                    'title': tm.group(2).strip(),
                    'subtopics': []
                }
                topics.append(current_topic)
            else:
                if current_topic is not None:
                    current_topic['subtopics'].append(ls.lstrip('-•* '))
                else:
                    # Maybe topic title without sub_code
                    current_topic = {
                        'sub_code': '',
                        'title': ls,
                        'subtopics': []
                    }
                    topics.append(current_topic)
                    
    units.append({
        'syllabus_code': code,
        'title': title,
        'description': desc,
        'objectives': objs,
        'num_topics': len(topics),
        'topics': topics
    })

print(f"\nParsed {len(units)} units from Module 3:")
for u in units:
    print(f"  {u['syllabus_code']} | {u['title']} | {len(u['objectives'])} objs | {u['num_topics']} topics")
    if u['topics']:
        print(f"    Sample topic 1: {u['topics'][0]['sub_code']} {u['topics'][0]['title']} ({len(u['topics'][0]['subtopics'])} subtopics)")
