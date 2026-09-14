import re
import json

with open('module_1_extracted.md', encoding='utf-8') as f:
    text = f.read()

# Split by unit pattern: e.g. "3.1.0 INFORMATION COMMUNICATION TECHNOLOGY"
unit_pattern = re.compile(r'(\d+\.1\.0\s+[^\n]+)')
parts = unit_pattern.split(text)

print(f"Total parts split: {len(parts)}")
# parts[0] is preamble
# parts[1] is unit 1 header, parts[2] is unit 1 body, etc.

units = []
for i in range(1, len(parts), 2):
    header = parts[i].strip()
    body = parts[i+1].strip() if i+1 < len(parts) else ""
    
    code_match = re.match(r'(\d+\.1\.0)\s+(.+)', header)
    syllabus_code = code_match.group(1) if code_match else ""
    title = code_match.group(2) if code_match else header
    
    # Description
    desc_match = re.search(r'Description:\s*(.*?)(?=\nGeneral Objectives:|\nRationale:|\nTopics|\Z)', body, re.DOTALL)
    description = desc_match.group(1).strip().replace('\n', ' ') if desc_match else ""
    
    # Objectives
    obj_match = re.search(r'General Objectives:.*?(?:able to:|\n)(.*?)(?=\nTopics|\nWhat the|\Z)', body, re.DOTALL)
    objectives_raw = obj_match.group(1).strip() if obj_match else ""
    
    # Parse lettered objectives a) b) c) or bulleted
    objs = []
    if objectives_raw:
        lettered = re.split(r'[a-z]\)\s*', objectives_raw)
        objs = [o.strip().rstrip(';') for o in lettered if o.strip()]
        if not objs:
            objs = [line.strip().lstrip('-•* ') for line in objectives_raw.split('\n') if line.strip()]
            
    # Topics
    topics_section = ""
    if "Topics and Subtopics:" in body:
        topics_section = body.split("Topics and Subtopics:")[1]
    elif "Topics and Subtopics (Chemistry):" in body:
        topics_section = body.split("Topics and Subtopics (Chemistry):")[1]
        
    topic_lines = [l.strip() for l in topics_section.split('\n') if l.strip() and not l.strip().startswith('End of Module') and not l.strip().startswith('What the')]
    
    parsed_topics = []
    for line in topic_lines:
        if line.startswith('Topics and Subtopics'):
            continue
        if '—' in line:
            t_title, s_topics = line.split('—', 1)
            parsed_topics.append({
                'title': t_title.strip(),
                'subtopics': [s.strip() for s in s_topics.split(';') if s.strip()]
            })
        elif '–' in line:
            t_title, s_topics = line.split('–', 1)
            parsed_topics.append({
                'title': t_title.strip(),
                'subtopics': [s.strip() for s in s_topics.split(';') if s.strip()]
            })
        else:
            parsed_topics.append({
                'title': line.strip(),
                'subtopics': []
            })
            
    units.append({
        'syllabus_code': syllabus_code,
        'title': title,
        'description': description,
        'objectives': objs,
        'num_topics': len(parsed_topics),
        'sample_topic': parsed_topics[0]['title'] if parsed_topics else None
    })

print(f"Parsed {len(units)} units from Module 1:")
for u in units:
    print(f"  {u['syllabus_code']} | {u['title']} | {len(u['objectives'])} objs | {u['num_topics']} topics")
