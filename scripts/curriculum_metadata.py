import re
import json
import os

def clean_text(t):
    if not t:
        return ""
    return " ".join(t.split()).strip()

# Canonical keys and metadata for Module 1
M1_METADATA = {
    "3.1.0": {
        "canonicalKey": "information_communication_technology",
        "nominalHours": 44,
        "theoryHours": 19,
        "practicalHours": 25,
        "aliases": ["CND 1201", "DND 1201", "DCU 1106", "CCU 1106", "ICT", "Digital Literacy", "3.1.0"],
        "references": [
            "French, C. S. (2018). Computer Science (5th ed.). Cengage Learning.",
            "Norton, P. (2018). Introduction to Computers. McGraw-Hill Education."
        ]
    },
    "4.1.0": {
        "canonicalKey": "entrepreneurship",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["CND 1102", "DND 1102", "CCU 1105", "DCU 1105", "4.1.0"],
        "references": [
            "Hisrich, R. D., Peters, M. P., & Shepherd, D. A. (2020). Entrepreneurship (11th ed.). McGraw-Hill.",
            "Kuratko, D. F. (2019). Entrepreneurship: Theory, Process, and Practice. Cengage Learning."
        ]
    },
    "5.1.0": {
        "canonicalKey": "communication_skills",
        "nominalHours": 44,
        "theoryHours": 24,
        "practicalHours": 20,
        "aliases": ["CND 1101", "DND 1101", "CCU 1101", "DCU 1101", "5.1.0"],
        "references": [
            "Stanton, N. (2017). Mastering Communication (5th ed.). Palgrave Macmillan.",
            "Taylor, S. (2019). Model Business Letters, Emails and Other Business Documents. Pearson."
        ]
    },
    "6.1.0": {
        "canonicalKey": "life_skills",
        "nominalHours": 33,
        "theoryHours": 20,
        "practicalHours": 13,
        "aliases": ["CND 1103", "DND 1103", "DCU 1106", "6.1.0"],
        "references": [
            "UNICEF. (2019). Global Framework on Transferable Skills. UNICEF.",
            "WHO. (2017). Life Skills Education for Children and Adolescents in Schools. WHO."
        ]
    },
    "7.1.0": {
        "canonicalKey": "basic_mathematics",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["CND 1104", "DND 1301", "CCU 1110", "DCU 1110", "7.1.0"],
        "references": [
            "Stroud, K. A., & Booth, D. J. (2020). Engineering Mathematics. Bloomsbury.",
            "Bird, J. (2017). Basic Engineering Mathematics. Routledge."
        ]
    },
    "8.1.0": {
        "canonicalKey": "physical_science",
        "nominalHours": 66,
        "theoryHours": 40,
        "practicalHours": 26,
        "aliases": ["CND 1106", "DND 1106", "DND 1204", "CCU 1111", "DCU 1111", "8.1.0"],
        "references": [
            "Chang, R., & Goldsby, K. A. (2016). Chemistry (12th ed.). McGraw-Hill Education.",
            "Giancoli, D. C. (2016). Physics: Principles with Applications. Pearson."
        ]
    },
    "9.1.0": {
        "canonicalKey": "human_anatomy_and_physiology",
        "nominalHours": 66,
        "theoryHours": 40,
        "practicalHours": 26,
        "aliases": ["CND 1105", "DND 1105", "CCU 1107", "DCU 1107", "9.1.0"],
        "references": [
            "Waugh, A., & Grant, A. (2018). Ross & Wilson Anatomy and Physiology in Health and Illness (13th ed.). Elsevier.",
            "Tortora, G. J., & Derrickson, B. H. (2017). Principles of Anatomy and Physiology (15th ed.). Wiley."
        ]
    },
    "10.1.0": {
        "canonicalKey": "hiv_and_aids",
        "nominalHours": 33,
        "theoryHours": 20,
        "practicalHours": 13,
        "aliases": ["DND 1103", "CCU 1104", "10.1.0"],
        "references": [
            "NASCOP. (2020). Guidelines on Use of Antiretroviral Drugs for Treating and Preventing HIV Infection in Kenya. Ministry of Health.",
            "WHO. (2021). Consolidated Guidelines on HIV Prevention, Testing, Treatment, Service Delivery and Monitoring. World Health Organization."
        ]
    },
    "11.1.0": {
        "canonicalKey": "introduction_to_nutrition_and_dietetics",
        "nominalHours": 44,
        "theoryHours": 28,
        "practicalHours": 16,
        "aliases": ["11.1.0", "Introduction to Nutrition and Dietetics"],
        "references": [
            "Mahan, L. K., & Raymond, J. L. (2020). Krause's Food & the Nutrition Care Process (15th ed.). Elsevier.",
            "KNDI. (2019). Core Competency Standards and Scope of Practice for Nutritionists and Dieticians in Kenya. KNDI."
        ]
    },
    "12.1.0": {
        "canonicalKey": "food_safety_and_hygiene",
        "nominalHours": 44,
        "theoryHours": 24,
        "practicalHours": 20,
        "aliases": ["CND 1203", "DND 1203", "12.1.0"],
        "references": [
            "Marriott, N. G., Schilling, M. W., & Gravani, R. B. (2018). Principles of Food Sanitation (6th ed.). Springer.",
            "Mortimore, S., & Wallace, C. (2018). HACCP: A Practical Approach (3rd ed.). Springer."
        ]
    },
    "13.1.0": {
        "canonicalKey": "food_production_invalids",
        "nominalHours": 66,
        "theoryHours": 26,
        "practicalHours": 40,
        "aliases": ["CND 1204", "DND 1304", "13.1.0"],
        "references": [
            "Ceserani, V., Kinton, R., & Foskett, D. (2018). Practical Cookery (13th ed.). Hodder Education.",
            "Escott-Stump, S. (2019). Nutrition and Diagnosis-Related Care (8th ed.). Wolters Kluwer."
        ]
    },
    "14.1.0": {
        "canonicalKey": "meal_planning_management_service",
        "nominalHours": 55,
        "theoryHours": 25,
        "practicalHours": 30,
        "aliases": ["CND 1302", "DND 1302", "14.1.0"],
        "references": [
            "Lillicrap, D., & Cousins, J. (2018). Food and Beverage Service (9th ed.). Hodder Education.",
            "Brown, J. E. (2019). Nutrition Through the Life Cycle (7th ed.). Cengage Learning."
        ]
    },
    "15.1.0": {
        "canonicalKey": "nutrition_anthropology",
        "nominalHours": 44,
        "theoryHours": 28,
        "practicalHours": 16,
        "aliases": ["CND 1304", "CND 1306", "15.1.0"],
        "references": [
            "Kittler, P. G., Sucher, K. P., & Nelms, M. (2017). Food and Culture (7th ed.). Cengage Learning.",
            "Messer, E. (2018). Nutritional Anthropology: Contemporary Approaches to Diet and Culture. Routledge."
        ]
    },
    "16.1.0": {
        "canonicalKey": "diet_therapy_i",
        "nominalHours": 66,
        "theoryHours": 36,
        "practicalHours": 30,
        "aliases": ["CND 1202", "DND 1202", "DND 1206", "16.1.0"],
        "references": [
            "Mahan, L. K., & Raymond, J. L. (2020). Krause's Food & the Nutrition Care Process (15th ed.). Elsevier.",
            "Rolfes, S. R., Pinna, K., & Whitney, E. (2018). Understanding Normal and Clinical Nutrition (11th ed.). Cengage."
        ]
    },
    "17.1.0": {
        "canonicalKey": "maternal_and_child_nutrition",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["CND 1303", "DND 1303", "17.1.0"],
        "references": [
            "Brown, J. E. (2019). Nutrition Through the Life Cycle (7th ed.). Cengage Learning.",
            "Ministry of Health. (2020). National Guidelines for Maternal, Infant and Young Child Nutrition. Republic of Kenya."
        ]
    },
    "18.1.0": {
        "canonicalKey": "nutrition_in_hiv_aids",
        "nominalHours": 44,
        "theoryHours": 28,
        "practicalHours": 16,
        "aliases": ["CND 1301", "DND 1305", "18.1.0"],
        "references": [
            "NASCOP. (2020). Clinical Guidelines for the Management of HIV Infection in Kenya. Ministry of Health.",
            "WHO. (2019). Nutritional Care and Support for People Living with HIV/AIDS. World Health Organization."
        ]
    },
    "19.1.0": {
        "canonicalKey": "legal_aspects_nutrition",
        "nominalHours": 44,
        "theoryHours": 30,
        "practicalHours": 14,
        "aliases": ["CND 1205", "DND 1205", "19.1.0"],
        "references": [
            "Laws of Kenya. (2012). Nutritionists and Dieticians Act No. 18 of 2012. Government Printer.",
            "Laws of Kenya. (2012). Public Health Act (Cap 242) and Food, Drugs and Chemical Substances Act (Cap 254)."
        ]
    },
    "20.1.0": {
        "canonicalKey": "principles_of_human_nutrition",
        "nominalHours": 66,
        "theoryHours": 42,
        "practicalHours": 24,
        "aliases": ["DND 1104", "20.1.0", "Principles of Human Nutrition"],
        "references": [
            "Gibney, M. J., Lanham-New, S. A., Cassidy, A., & Vorster, H. H. (2019). Introduction to Human Nutrition (3rd ed.). Wiley-Blackwell.",
            "Whitney, E., & Rolfes, S. R. (2019). Understanding Nutrition (15th ed.). Cengage Learning."
        ]
    },
    "21.1.0": {
        "canonicalKey": "industrial_attachment_i",
        "nominalHours": 330,
        "theoryHours": 0,
        "practicalHours": 330,
        "aliases": ["CND 2103", "21.1.0", "Industrial Attachment I"],
        "references": [
            "KNDI. (2020). Professional Internship and Industrial Attachment Training Logbook. KNDI.",
            "CDACC. (2021). TVET Industrial Attachment Guidelines. Ministry of Education."
        ]
    }
}

# Module 3 canonical keys and metadata
M3_METADATA = {
    "34.3.0": {
        "canonicalKey": "food_microbiology_parasitology",
        "nominalHours": 66,
        "theoryHours": 39,
        "practicalHours": 27,
        "aliases": ["34.3.0", "Food Microbiology and Parasitology"],
        "references": [
            "Jay, J. M., Loessner, M. J., & Golden, D. A. (2018). Modern Food Microbiology (7th ed.). Springer.",
            "Adams, M. R., & Moss, M. O. (2019). Food Microbiology (4th ed.). Royal Society of Chemistry."
        ]
    },
    "35.3.0": {
        "canonicalKey": "communicable_non_communicable",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["35.3.0", "Communicable and Non-Communicable Diseases"],
        "references": [
            "Heymann, D. L. (2020). Control of Communicable Diseases Manual (21st ed.). APHA.",
            "WHO. (2020). Global Status Report on Noncommunicable Diseases. World Health Organization."
        ]
    },
    "36.3.0": {
        "canonicalKey": "food_security",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["36.3.0", "Food Security"],
        "references": [
            "FAO, IFAD, UNICEF, WFP and WHO. (2021). The State of Food Security and Nutrition in the World. FAO.",
            "Coates, J. (2018). Measuring Food Security: Principles and Practice. Practical Action Publishing."
        ]
    },
    "37.3.0": {
        "canonicalKey": "nutrition_education_counselling",
        "nominalHours": 66,
        "theoryHours": 36,
        "practicalHours": 30,
        "aliases": ["37.3.0", "Nutrition Education and Counselling"],
        "references": [
            "Contento, I. R. (2020). Nutrition Education: Linking Research, Theory, and Practice (4th ed.). Jones & Bartlett Learning.",
            "Snetselaar, L. G. (2019). Nutrition Counseling Skills for the Practitioner. Jones & Bartlett Learning."
        ]
    },
    "38.3.0": {
        "canonicalKey": "diet_therapy_iii",
        "nominalHours": 66,
        "theoryHours": 36,
        "practicalHours": 30,
        "aliases": ["38.3.0", "Diet Therapy III", "Diet Therapy II"],
        "references": [
            "Mahan, L. K., & Raymond, J. L. (2020). Krause's Food & the Nutrition Care Process (15th ed.). Elsevier.",
            "Escott-Stump, S. (2019). Nutrition and Diagnosis-Related Care (8th ed.). Wolters Kluwer."
        ]
    },
    "39.3.0": {
        "canonicalKey": "nutrition_epidemiology",
        "nominalHours": 66,
        "theoryHours": 40,
        "practicalHours": 26,
        "aliases": ["39.3.0", "Nutrition Epidemiology"],
        "references": [
            "Willett, W. (2018). Nutritional Epidemiology (3rd ed.). Oxford University Press.",
            "Gordis, L. (2019). Epidemiology (6th ed.). Elsevier."
        ]
    },
    "40.3.0": {
        "canonicalKey": "nutrition_in_emergencies",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["CND 2301", "DND 2301", "40.3.0", "Nutrition in Emergencies"],
        "references": [
            "Sphere Association. (2018). The Sphere Handbook: Humanitarian Charter and Minimum Standards in Humanitarian Response.",
            "Emergency Nutrition Network (ENN). (2020). Infant and Young Child Feeding in Emergencies Operational Guidance."
        ]
    },
    "41.3.0": {
        "canonicalKey": "community_partnership_skills",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["41.3.0", "Community Partnership Skills"],
        "references": [
            "Rabinowitz, P., & Fawcett, S. B. (2020). Building and Sustaining Collaborative Partnerships. Community Tool Box.",
            "Oakley, P. (2018). Community Involvement in Health Development: An Examination of the Critical Issues. WHO."
        ]
    },
    "42.3.0": {
        "canonicalKey": "nutrition_assessment_surveillance",
        "nominalHours": 66,
        "theoryHours": 36,
        "practicalHours": 30,
        "aliases": ["CND 2302", "DND 2302", "42.3.0", "Nutrition Assessment and Surveillance"],
        "references": [
            "Gibson, R. S. (2019). Principles of Nutritional Assessment (2nd ed.). Oxford University Press.",
            "WHO. (2020). Training Course on Child Growth Assessment. World Health Organization."
        ]
    },
    "43.3.0": {
        "canonicalKey": "product_development_marketing_sales",
        "nominalHours": 55,
        "theoryHours": 30,
        "practicalHours": 25,
        "aliases": ["43.3.0", "Product Development, Marketing and Sales"],
        "references": [
            "Earle, M., Earle, R., & Anderson, A. (2018). Food Product Development: Maximising Success. Woodhead Publishing.",
            "Kotler, P., & Armstrong, G. (2020). Principles of Marketing (18th ed.). Pearson."
        ]
    },
    "44.3.0": {
        "canonicalKey": "industrial_organization_management",
        "nominalHours": 55,
        "theoryHours": 35,
        "practicalHours": 20,
        "aliases": ["44.3.0", "Industrial Organization and Management"],
        "references": [
            "Cole, G. A., & Kelly, P. (2020). Management Theory and Practice (8th ed.). Cengage Learning.",
            "Robbins, S. P., & Coulter, M. (2021). Management (15th ed.). Pearson."
        ]
    },
    "45.3.0": {
        "canonicalKey": "trade_project",
        "nominalHours": 110,
        "theoryHours": 20,
        "practicalHours": 90,
        "aliases": ["CND 2306", "45.3.0", "Trade Project"],
        "references": [
            "KNEC. (2021). Guidelines for Trade Projects in Technical Examinations. Kenya National Examinations Council.",
            "Mugenda, O. M., & Mugenda, A. G. (2019). Research Methods: Quantitative and Qualitative Approaches. ACTS Press."
        ]
    }
}

print("Metadata configurations loaded.")
