import re

def transform_to_learning_outcome(sub, topic=""):
    s = sub.strip().rstrip('.;')
    s_lower = s.lower()
    
    # Check if already starts with an action verb
    action_verbs = [
        "define", "explain", "describe", "discuss", "classify", "identify",
        "demonstrate", "calculate", "analyze", "evaluate", "apply", "distinguish",
        "differentiate", "outline", "state", "list", "formulate", "illustrate", "carry out"
    ]
    words = s.split()
    if words and words[0].lower() in action_verbs:
        # Already has an action verb, just capitalize first letter
        return f"• {s[0].upper() + s[1:]}."
        
    # Patterns
    if re.match(r'^(meaning of terms|concept of terms|definition of terms|definitions?|terminology)', s_lower):
        ctx = topic if topic else "this topic"
        return f"• Define the terms and concepts used in {ctx}."
    elif re.match(r'^concept of\s+(.+)', s_lower):
        m = re.match(r'^concept of\s+(.+)', s, re.IGNORECASE)
        return f"• Explain the concept of {m.group(1)}."
    elif re.match(r'^(history and classification|classification of|types of|categories of|classes of)\s+(.+)', s_lower):
        m = re.match(r'^(history and classification|classification of|types of|categories of|classes of)\s+(.+)', s, re.IGNORECASE)
        return f"• Classify {m.group(2)} and describe their categories."
    elif re.match(r'^(structure and function|structure of|components of|anatomy of)\s+(.+)', s_lower):
        m = re.match(r'^(structure and function|structure of|components of|anatomy of)\s+(.+)', s, re.IGNORECASE)
        return f"• Describe the structure and components of {m.group(2)}."
    elif re.match(r'^(functions? of|roles? of|significance of|importance of)\s+(.+)', s_lower):
        m = re.match(r'^(functions? of|roles? of|significance of|importance of)\s+(.+)', s, re.IGNORECASE)
        return f"• Explain the functions and physiological role of {m.group(2)}."
    elif re.match(r'^(sources? of|dietary sources?)\s*(.*)', s_lower):
        m = re.match(r'^(sources? of|dietary sources?)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2) if m.group(2) else topic
        return f"• Identify dietary sources of {target}."
    elif re.match(r'^(digestion of|absorption of|metabolism of|digestion,\s*absorption)\s*(.*)', s_lower):
        m = re.match(r'^(digestion of|absorption of|metabolism of|digestion,\s*absorption)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2) if m.group(2) else topic
        return f"• Explain the digestion, absorption and metabolism of {target}."
    elif re.match(r'^(calculation of|calculating|pricing of|costing)\s+(.+)', s_lower):
        m = re.match(r'^(calculation of|calculating|pricing of|costing)\s+(.+)', s, re.IGNORECASE)
        return f"• Calculate {m.group(2)} accurately."
    elif re.match(r'^(deficiency|signs and symptoms|disorders of|common disorders)\s*(.*)', s_lower):
        m = re.match(r'^(deficiency|signs and symptoms|disorders of|common disorders)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2) if m.group(2) else topic
        return f"• Describe deficiency signs, symptoms and disorders related to {target}."
    elif re.match(r'^(prevention|preventive measures|control of|management of)\s+(.+)', s_lower):
        m = re.match(r'^(prevention|preventive measures|control of|management of)\s+(.+)', s, re.IGNORECASE)
        return f"• Explain prevention, control and management measures for {m.group(2)}."
    elif re.match(r'^(factors affecting|factors influencing|causes and effects|causes of)\s+(.+)', s_lower):
        m = re.match(r'^(factors affecting|factors influencing|causes and effects|causes of)\s+(.+)', s, re.IGNORECASE)
        return f"• Analyze factors affecting {m.group(2)}."
    elif re.match(r'^(procedures? for|methods of|techniques of|preparation of)\s+(.+)', s_lower):
        m = re.match(r'^(procedures? for|methods of|techniques of|preparation of)\s+(.+)', s, re.IGNORECASE)
        return f"• Describe methods and procedures for {m.group(2)}."
    elif re.match(r'^(emerging issues|challenges|trends)\s*(.*)', s_lower):
        return f"• Discuss emerging issues, trends and coping strategies in {topic or 'this field'}."
        
    # Default verb insertion based on text content
    if "principle" in s_lower:
        return f"• Explain the {s}."
    elif "law" in s_lower or "rule" in s_lower:
        return f"• State and apply the {s}."
    elif "table" in s_lower or "chart" in s_lower or "pyramid" in s_lower:
        return f"• Interpret and utilize {s}."
    elif "equipment" in s_lower or "tool" in s_lower:
        return f"• Demonstrate safe handling and application of {s}."
    elif "system" in s_lower or "process" in s_lower:
        return f"• Describe the operation and significance of {s}."
    else:
        # Fallback to describe or explain
        return f"• Explain {s}."

test_cases = [
    ("Meaning of terms", "Introduction to Nutrition"),
    ("Classification of food", "Introduction to Nutrition"),
    ("Nutrition as a science", "Introduction to Nutrition"),
    ("Basic principles of human nutrition", "Introduction to Nutrition"),
    ("Classification of carbohydrates", "Carbohydrates"),
    ("Sources of carbohydrates", "Carbohydrates"),
    ("Functions of carbohydrates", "Carbohydrates"),
    ("Dietary fibre", "Carbohydrates"),
    ("Digestion of carbohydrates", "Carbohydrates"),
    ("Structure of a cell", "Cellular Biology"),
    ("Plasma membrane and organelles", "Cellular Biology"),
    ("Axial and appendicular skeletal system", "Skeletal System"),
    ("Water uptake and loss", "Water"),
    ("Calculation of oxidation numbers", "Redox Reactions"),
    ("Explain the HIV situation in Kenya", "HIV"),
    ("Emerging issues and trends", "Principles of Human Nutrition")
]

for sub, top in test_cases:
    print(f"{sub} -> {transform_to_learning_outcome(sub, top)}")
