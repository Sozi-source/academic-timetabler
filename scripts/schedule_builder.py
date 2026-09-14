import re
import json
import os
from curriculum_metadata import M1_METADATA, M3_METADATA

def clean_text(t):
    if not t:
        return ""
    return " ".join(str(t).split()).strip()

def lower_first_if_not_acronym(text):
    words = clean_text(text).split()
    if not words:
        return ""
    if words[0].isupper() and len(words[0]) > 1:
        return text
    return words[0].lower() + (" " + " ".join(words[1:]) if len(words) > 1 else "")

def transform_to_learning_outcome(sub, topic=""):
    s = clean_text(sub).rstrip('.;')
    if not s:
        return ""
    s_lower = s.lower()
    
    # Check if already starts with an action verb
    action_verbs = [
        "define", "explain", "describe", "discuss", "classify", "identify",
        "demonstrate", "calculate", "analyze", "evaluate", "apply", "distinguish",
        "differentiate", "outline", "state", "list", "formulate", "illustrate", "carry out"
    ]
    words = s.split()
    if words and words[0].lower() in action_verbs:
        return f"• {s[0].upper() + s[1:]}."
        
    # Standard TVET syllabus subtopic patterns
    if re.match(r'^(meaning of terms|concept of terms|definition of terms|definitions?|terminology)', s_lower):
        ctx = topic if topic else "this unit"
        return f"• Define terms and concepts used in {ctx}."
    elif re.match(r'^concept of\s+(.+)', s_lower):
        m = re.match(r'^concept of\s+(.+)', s, re.IGNORECASE)
        target = m.group(1).strip()
        return f"• Explain the concept of {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(history and classification|classification of|types of|categories of|classes of)\s+(.+)', s_lower):
        m = re.match(r'^(history and classification|classification of|types of|categories of|classes of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Classify {lower_first_if_not_acronym(target)} and describe their categories."
    elif re.match(r'^(structure and function|structure of|components of|anatomy of)\s+(.+)', s_lower):
        m = re.match(r'^(structure and function|structure of|components of|anatomy of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Describe the structure and components of {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(functions? of|roles? of|significance of|importance of)\s+(.+)', s_lower):
        m = re.match(r'^(functions? of|roles? of|significance of|importance of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Explain the functions and physiological role of {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(sources? of|dietary sources?)\s*(.*)', s_lower):
        m = re.match(r'^(sources? of|dietary sources?)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2).strip() if m.group(2) else topic
        return f"• Identify dietary sources of {lower_first_if_not_acronym(target)}."
    elif "absorption, metabolism and excretion" in s_lower:
        target = re.sub(r'.*excretion of\s*', '', s, flags=re.IGNORECASE).strip()
        return f"• Explain the absorption, cellular metabolism and excretion of {lower_first_if_not_acronym(target or topic or 'nutrients')}."
    elif re.match(r'^(digestion of|absorption of|metabolism of|digestion,\s*absorption|absorption,\s*metabolism)\s*(.*)', s_lower):
        m = re.match(r'^(digestion of|absorption of|metabolism of|digestion,\s*absorption|absorption,\s*metabolism)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2).strip() if m.group(2) else topic
        target = re.sub(r'^(and\s+)', '', target).strip()
        return f"• Explain the digestion, absorption and metabolism of {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(calculation of|calculating|pricing of|costing)\s+(.+)', s_lower):
        m = re.match(r'^(calculation of|calculating|pricing of|costing)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Calculate {lower_first_if_not_acronym(target)} accurately."
    elif re.match(r'^(deficiency|signs and symptoms|disorders of|common disorders)\s*(.*)', s_lower):
        m = re.match(r'^(deficiency|signs and symptoms|disorders of|common disorders)\s*(.*)', s, re.IGNORECASE)
        target = m.group(2).strip() if m.group(2) else topic
        return f"• Describe deficiency signs, symptoms and disorders related to {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(prevention|preventive measures|control of|management of)\s+(.+)', s_lower):
        m = re.match(r'^(prevention|preventive measures|control of|management of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Explain prevention, control and management measures for {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(factors affecting|factors influencing|causes and effects|causes of)\s+(.+)', s_lower):
        m = re.match(r'^(factors affecting|factors influencing|causes and effects|causes of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Analyze factors affecting {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(procedures? for|methods of|techniques of|preparation of)\s+(.+)', s_lower):
        m = re.match(r'^(procedures? for|methods of|techniques of|preparation of)\s+(.+)', s, re.IGNORECASE)
        target = m.group(2).strip()
        return f"• Describe methods and procedures for {lower_first_if_not_acronym(target)}."
    elif re.match(r'^(emerging issues|challenges|trends)\s*(.*)', s_lower):
        return f"• Discuss emerging issues, trends and coping strategies in {lower_first_if_not_acronym(topic or 'this unit')}."
        
    # Heuristics based on keywords
    if "basic principle" in s_lower or "principles of" in s_lower:
        return f"• Describe the {lower_first_if_not_acronym(s)}."
    elif "as a science" in s_lower:
        return f"• Explain {lower_first_if_not_acronym(s)}."
    elif "classification" in s_lower:
        return f"• Classify {lower_first_if_not_acronym(s)}."
    elif "law" in s_lower or "rule" in s_lower:
        return f"• State and apply the {lower_first_if_not_acronym(s)}."
    elif "table" in s_lower or "chart" in s_lower or "pyramid" in s_lower:
        return f"• Interpret and apply {lower_first_if_not_acronym(s)}."
    elif "equipment" in s_lower or "tool" in s_lower:
        return f"• Demonstrate safe handling and operation of {lower_first_if_not_acronym(s)}."
    elif "system" in s_lower or "process" in s_lower:
        return f"• Describe the structure, components and function of {lower_first_if_not_acronym(s)}."
    elif "fibre" in s_lower or "fiber" in s_lower:
        return f"• Discuss the role, sources and physiological importance of {lower_first_if_not_acronym(s)}."
    elif "hydrolysis" in s_lower:
        return f"• Explain the chemical process and mechanisms of {lower_first_if_not_acronym(s)}."
    elif "balance" in s_lower:
        return f"• Explain the principles of {lower_first_if_not_acronym(s)}."
    elif "uptake" in s_lower or "loss" in s_lower:
        return f"• Describe physiological mechanisms of {lower_first_if_not_acronym(s)}."
    elif "requirement" in s_lower or "rda" in s_lower or "allowance" in s_lower:
        return f"• Determine and calculate recommended dietary allowances and nutrient requirements."
    elif "value" in s_lower:
        return f"• Evaluate {lower_first_if_not_acronym(s)}."
    else:
        return f"• Explain {lower_first_if_not_acronym(s)}."

def build_14_week_schedule(topics, unit_name, syllabus_code, nominal_hours):
    weekly_hours = max(2, round(nominal_hours / 14)) if nominal_hours else 4
    
    is_anatomy = "anatomy" in unit_name.lower()
    schedule = []
    
    # Industrial Attachment
    if not topics:
        for w in range(1, 15):
            schedule.append({
                "weekNumber": w,
                "topicTitle": f"Industrial Attachment Practical Placement Week {w}",
                "subTopics": [
                    "Institutional and hospital clinical placement duties",
                    "Patient dietetic assessment, counseling and chart documentation",
                    "Weekly supervisor evaluation and logbook maintenance"
                ],
                "hours": weekly_hours,
                "specificLearningOutcomes": f"By the end of the lesson/topic, the trainee should be able to:\n• Demonstrate practical professional competence in clinical attachment during Week {w}.\n• Maintain accurate dietetic records and client consultation notes.\n• Adhere to professional code of conduct and workplace safety standards.",
                "learningActivities": "Practical workplace rotations, ward rounds, client counseling, and logbook entries.",
                "resourcesAndReferences": "Hospital dietetic manuals, patient records, logbooks.",
                "assessmentAndRemarks": "Supervisor logbook signing and clinical skills checklist."
            })
        return schedule
        
    # Anatomy & Physiology custom mapping
    if is_anatomy:
        custom_weeks = [
            (1, "Introduction to Human Anatomy and Physiology & Cellular Biology", 
             ["Meaning of terms", "Structure of a cell", "Plasma membrane and organelles", "Structure and function of the nucleus"]),
            (2, "The Body Tissue, Membranes and Glands", 
             ["Types of muscles", "Contraction and relaxation of muscles", "Types of epithelium", "Structure of tissue membranes"]),
            (3, "The Circulatory System & Cardiovascular System", 
             ["Structure and function of the circulatory system", "Heart and blood vessels", "Common disorders of the circulatory system"]),
            (4, "The Skeletal System & Musculoskeletal Framework", 
             ["Axial and appendicular skeletal system", "Common disorders of the skeletal system"]),
            (5, "The Lymphatic System & Immune Defense", 
             ["Structure of the lymphatic system", "Functions of the lymphatic system", "Lymphatic vessels", "Functions of lymphocytes", "Relevant lymph nodes"]),
            (6, "The Respiratory System & Pulmonary Mechanics", 
             ["Anatomy of the respiratory system", "Function of the respiratory system", "Physiology of the respiratory system", "Respiration process", "Disorders of the respiratory system"]),
            (7, "The Gastrointestinal Tract (GIT) & Digestive System", 
             ["Structure of the GIT", "Functions of GIT organs", "Factors affecting the digestive process", "Common disorders of the GIT"]),
            (8, "Mid-Term Continuous Assessment Test (CAT) & Academic Progress Review", 
             ["Written theory and diagrammatic evaluation covering Weeks 1 to 7", "Evaluation of Cellular Biology, Tissues, Cardiovascular, Respiratory and Digestive Systems", "Remediation and paper review"]),
            (9, "The Endocrine System & Hormonal Control", 
             ["Structure and functions of the major endocrine glands", "Disorders of the endocrine system"]),
            (10, "The Urinary System & Renal Regulation", 
             ["Structure of the renal system", "Structure of the kidney and nephron", "Formation of urine", "Acid-base balance", "Common disorders"]),
            (11, "Homeostasis & Fluid Electrolyte Balance", 
             ["Meaning of terms", "Body fluid compartments", "Sources of fluid, electrolyte and water", "Major electrolytes", "Maintenance of electrolyte and fluid balance"]),
            (12, "The Reproductive & Nervous Systems", 
             ["Male and female reproductive systems", "Gametes and fertilization", "The neuron and nervous reflexes", "Central and peripheral nervous system"]),
            (13, "Sensory Organs, Skin & Comprehensive Syllabus Revision", 
             ["Structure and function of sensory organs", "Structure and function of the skin", "Emerging issues and trends", "Remediation and past paper clinic"]),
            (14, "Final Summative Examination", 
             ["Comprehensive institutional TVET final theory and practical examinations"])
        ]
        for w_num, title, subs in custom_weeks:
            if w_num == 8:
                outcomes = "By the end of the lesson/topic, the trainee should be able to:\n• Demonstrate theoretical understanding of cellular biology, cardiovascular, respiratory and digestive systems.\n• Analyze anatomical diagrams and apply physiological concepts in assessment.\n• Identify areas requiring revision and academic remediation."
            elif w_num == 14:
                outcomes = "By the end of the lesson/topic, the trainee should be able to:\n• Demonstrate overall professional competency in human anatomy and physiology in accordance with TVET national examination standards."
            else:
                bullets = [transform_to_learning_outcome(s, title) for s in subs[:4]]
                outcomes = "By the end of the lesson/topic, the trainee should be able to:\n" + "\n".join([b for b in bullets if b])
                
            schedule.append({
                "weekNumber": w_num,
                "topicTitle": title,
                "subTopics": subs,
                "hours": weekly_hours,
                "specificLearningOutcomes": outcomes,
                "learningActivities": "Interactive lectures, anatomical charts, 3D anatomical models, and practical laboratory microscopy." if w_num not in [8, 14] else "Supervised formal written and practical examination.",
                "resourcesAndReferences": "Waugh, A., & Grant, A. (2018). Ross & Wilson Anatomy and Physiology in Health and Illness (13th ed.). Elsevier.",
                "assessmentAndRemarks": "Official Mid-Term Continuous Assessment Test (CAT)" if w_num == 8 else ("Final Summative Examination (70%)" if w_num == 14 else "Continuous evaluation, oral questions, and practical checks.")
            })
        return schedule

    # General distribution for units
    # 11 teaching weeks: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12]
    # Week 8: Single CAT
    # Week 13: Comprehensive Revision (No CAT)
    # Week 14: Final Summative Examination
    teaching_weeks = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12]
    num_t = len(topics)
    assigned_topics = {w: [] for w in teaching_weeks}
    
    if num_t <= len(teaching_weeks):
        for i, t in enumerate(topics):
            w = teaching_weeks[i]
            assigned_topics[w].append(t)
    else:
        for i, t in enumerate(topics):
            w_idx = min(i * len(teaching_weeks) // num_t, len(teaching_weeks) - 1)
            w = teaching_weeks[w_idx]
            assigned_topics[w].append(t)
            
    for w in range(1, 15):
        if w == 8:
            schedule.append({
                "weekNumber": 8,
                "topicTitle": f"Continuous Assessment Test (CAT) & Mid-Term Review ({unit_name})",
                "subTopics": [
                    "Supervised written theory evaluation covering Weeks 1 to 7",
                    "Practical application, case study or laboratory assessment",
                    "Post-examination question review, grading feedback and academic remediation"
                ],
                "hours": weekly_hours,
                "specificLearningOutcomes": f"By the end of the lesson/topic, the trainee should be able to:\n• Demonstrate mastery of theoretical and practical concepts covered in Weeks 1 to 7 of {unit_name}.\n• Analyze continuous assessment feedback to identify conceptual gaps.\n• Formulate personalized academic revision plans.",
                "learningActivities": "Supervised written continuous assessment test followed by plenary question walkthrough and individual feedback.",
                "resourcesAndReferences": "Official continuous assessment test scripts, standard marking keys, and lecture course manuals.",
                "assessmentAndRemarks": "Official Continuous Assessment Test (CAT coursework mark)."
            })
        elif w == 13:
            last_topic = topics[-1] if topics and "emerging" in topics[-1]['title'].lower() else None
            t_title = f"{last_topic['title']} & Comprehensive Syllabus Revision" if last_topic else f"Comprehensive Syllabus Revision & Tutorial Clinic ({unit_name})"
            subs = last_topic['subtopics'] if last_topic else [
                "Comprehensive review of all core unit competencies and learning outcomes",
                "Analysis of KNEC past examination questions and model marking schemes",
                "Tutorial clinics, student presentations, and academic remediation"
            ]
            bullets = [transform_to_learning_outcome(s, t_title) for s in subs[:4]]
            outcomes = f"By the end of the lesson/topic, the trainee should be able to:\n" + "\n".join([b for b in bullets if b]) if bullets else f"By the end of the lesson/topic, the trainee should be able to:\n• Consolidate understanding of all syllabus topics in {unit_name} and prepare for final summative assessment."
            
            schedule.append({
                "weekNumber": 13,
                "topicTitle": t_title,
                "subTopics": subs,
                "hours": weekly_hours,
                "specificLearningOutcomes": outcomes,
                "learningActivities": "Group tutorials, past paper problem-solving clinics, student presentations, and plenary review.",
                "resourcesAndReferences": "KNEC past examination question banks, model solutions, and prescribed textbooks.",
                "assessmentAndRemarks": "Revision exercises, mock questions, and individual learner support (No CAT)."
            })
        elif w == 14:
            schedule.append({
                "weekNumber": 14,
                "topicTitle": f"Final Summative Examination ({unit_name})",
                "subTopics": [
                    "Administration of official TVET institutional / KNEC summative examination",
                    "Comprehensive assessment of all prescribed unit learning outcomes",
                    "Evaluation of vocational competences, theory, and practical applications"
                ],
                "hours": weekly_hours,
                "specificLearningOutcomes": f"By the end of the lesson/topic, the trainee should be able to:\n• Demonstrate overall professional competency and academic achievement in {unit_name} in accordance with national TVET standards.",
                "learningActivities": "Formal summative written and practical examinations administered under TVET examination regulations.",
                "resourcesAndReferences": "Official examination question papers, answer booklets, and examination rubrics.",
                "assessmentAndRemarks": "Final summative institutional/KNEC examination (weighted 70%)."
            })
        else:
            # Teaching week (1..7, 9..12)
            t_list = assigned_topics.get(w, [])
            if t_list:
                combined_title = " & ".join([t['title'] for t in t_list])
                combined_subs = []
                for t in t_list:
                    combined_subs.extend(t['subtopics'])
                if not combined_subs:
                    combined_subs = [f"Theoretical concepts of {combined_title}", f"Practical applications of {combined_title}"]
                    
                bullets = []
                seen_bullets = set()
                for s in combined_subs:
                    b = transform_to_learning_outcome(s, combined_title)
                    if b and b not in seen_bullets:
                        seen_bullets.add(b)
                        bullets.append(b)
                    if len(bullets) >= 5:
                        break
                        
                outcomes = "By the end of the lesson/topic, the trainee should be able to:\n" + "\n".join(bullets)
                
                schedule.append({
                    "weekNumber": w,
                    "topicTitle": combined_title,
                    "subTopics": combined_subs,
                    "hours": weekly_hours,
                    "specificLearningOutcomes": outcomes,
                    "learningActivities": "Interactive lecture presentations, group discussions, practical demonstrations, and laboratory exercises.",
                    "resourcesAndReferences": "Prescribed textbook references, lecture presentations, and practical equipment.",
                    "assessmentAndRemarks": "Class quiz, oral questions, practical observation, and assignment evaluation."
                })
            else:
                schedule.append({
                    "weekNumber": w,
                    "topicTitle": f"Applied Practice & Case Studies in {unit_name} (Week {w})",
                    "subTopics": [
                        "Practical laboratory demonstration and applied exercises",
                        "Group case study analysis and interactive student presentations",
                        "Individual tutorial assignment and competency evaluation"
                    ],
                    "hours": weekly_hours,
                    "specificLearningOutcomes": f"By the end of the lesson/topic, the trainee should be able to:\n• Apply theoretical principles of {unit_name} in practical and clinical scenarios.\n• Analyze occupational case studies and present clinical recommendations.",
                    "learningActivities": "Practical demonstrations, case study discussions, and tutorial problem solving.",
                    "resourcesAndReferences": "Prescribed textbook references and clinical laboratory guides.",
                    "assessmentAndRemarks": "Practical checklist assessment and tutor feedback."
                })
                
    return schedule
