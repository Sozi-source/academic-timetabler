from exam_engine.paper_parser import parse_paper
from exam_engine.metadata import classify

STANDARD = """DIET THERAPY II

TIME: 2 hours

DHN 2205

SECTION A: (40 MARKS)

Attempt all questions in this section

{a}

SECTION B: (60 MARKS)

Attempt any THREE questions in this section.

11. Henry is 41 years old.

a)  Describe two ways. (4marks)

b)  Discuss four problems. (8marks)

c)  Explain four causes. (8marks)

12. Lucas is 34.

a)  Identify four aspects. (4marks)

b)  Explain four benefits. (8marks)

c)  Outline eight recommendations. (8marks)

13. Pancreatitis is an inflammation.

a)  Explain two functions. (4marks)

b)  Discuss five complications. (10marks)

c)  Outline six modifications. (6marks)

14. Sarah was admitted.

a)  Give one symptom. (2marks)

b)  Identify five causes. (5marks)

c)  State three ways. (3marks)

d)  Explain five modifications. (10marks)
"""
A10 = "\n\n".join(f"{i}.  Item {i}. ({m}marks)" for i, m in enumerate([4, 5, 4, 4, 4, 4, 4, 4, 3, 4], 1))


def test_standard_layout_is_clean():
    p = parse_paper(STANDARD.format(a=A10))
    assert p.issues == [] and p.notes == []
    assert [s.label for s in p.sections] == ["A", "B"]
    assert p.sections[1].choice_answer == 3
    assert [q.total() for q in p.sections[1].questions] == [20, 20, 20, 20]
    assert p.unit_code == "DHN 2205"
    assert p.duration_text.lower().startswith("2 hours")


def test_inline_part_a_and_unspaced_labels():
    a = A10
    text = STANDARD.format(a=a).replace(
        "11. Henry is 41 years old.\n\na)  Describe two ways. (4marks)",
        "11. (a)Describe two ways. (4marks)")
    p = parse_paper(text)
    assert p.sections[1].questions[0].total() == 20


def test_marks_typos_are_tolerated():
    a = A10.replace("(4marks)", "(4 Marks", 1)
    p = parse_paper(STANDARD.format(a=a))
    assert p.issues == [] and p.notes == []


def test_trainer_marks_error_is_noted_not_blocking():
    a = A10.replace("(3marks)", "(5marks)")
    p = parse_paper(STANDARD.format(a=a))
    assert p.issues == []  # readable; the paper is just off-standard
    assert any("adds to 42, standard is 40" in n for n in p.notes)


def test_cover_mention_of_section_b_is_ignored():
    text = "SECTION B.\n\nCandidates should check.\n\n" + STANDARD.format(a=A10)
    p = parse_paper(text)
    assert [s.label for s in p.sections] == ["A", "B"]


def test_path_metadata():
    m = classify("2024/MAY-AUG/Jane Waithera/PP2/Marking schemes/DIET THERAPY II.docx")
    assert (m.year, m.series, m.trainer, m.doc_kind, m.paper_kind) == (2024, "MAY-AUG", "Jane Waithera", "scheme", "supplementary")
    m = classify("2026/Martin Wanjohi/PP1/FOOD SECURITY.docx")
    assert (m.year, m.series, m.trainer, m.doc_kind, m.paper_kind) == (2026, None, "Martin Wanjohi", "paper", "main")
