"""Parse the plain text of a past paper into sections, questions and parts.

Design rules
------------
* Never guess silently. Every paper gets a list of `issues`; a paper with no
  issues has marks that add up exactly as its own instructions say.
* Part labels are classified by *kind* (number / letter / roman) rather than by
  indentation, because pandoc's indentation differs between papers.
* Marks are read from "(4 marks)", "(4marks)", "(4 mks)", "[4 marks]".
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Optional

MARK_RE = re.compile(r"[\(\[]\s*(\d{1,2})\s*(?:marks?|mks?)\s*[\)\]]", re.I)
SECTION_RE = re.compile(r"^\s*SECTION\s+([A-E])\b(.*)$", re.I)
NUM_RE = re.compile(r"^\s*(\d{1,2})\s*[.)]\s+(\S.*)$")
LABEL_RE = re.compile(r"^\s*\(?([a-hA-H]|i{1,3}|iv|vi{0,3}|ix|x)\s*(?:\)\s*|\.\s+)(\S.*)$")
ROMAN = {"i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"}
WORDNUM = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8}
# The college standard. Used instead of whatever a paper's own heading says.
STANDARD_MARKS = {"A": 40, "B": 60}
STANDARD_CHOICE = {"A": None, "B": 3}  # Section B: answer any three

BOILERPLATE = re.compile(
    r"^(turn over|this paper consists|candidates should|maximum marks|instructions?\b|"
    r"attempt\b|answer\b|do not write|icmhs\s+\d{4}|\[?c:\\|.*printed pages?)", re.I)


@dataclass
class Part:
    label: str
    kind: str  # 'letter' | 'roman'
    text: str
    own_marks: Optional[int] = None
    parts: list["Part"] = field(default_factory=list)
    upper: bool = False

    def total(self) -> Optional[int]:
        if self.parts:
            vals = [p.total() for p in self.parts]
            if all(v is not None for v in vals):
                return sum(value for value in vals if value is not None)
            return self.own_marks
        return self.own_marks


@dataclass
class Question:
    number: int
    text: str
    own_marks: Optional[int] = None
    parts: list[Part] = field(default_factory=list)
    kind: str = "written"  # 'written' | 'mcq'

    def total(self) -> Optional[int]:
        if self.kind == "mcq":
            return self.own_marks
        if self.parts:
            vals = [p.total() for p in self.parts]
            if all(v is not None for v in vals):
                return sum(value for value in vals if value is not None)
            # Grouped short items ("Define: a) X  b) Y (4 marks)"): the marks
            # sit on the last item and cover the whole group.
            blank = [p for p in self.parts if p.total() is None]
            if self.own_marks is None and all(len(p.text.split()) <= 6 for p in blank):
                got = [v for v in vals if v is not None]
                if got:
                    return sum(got)
            return self.own_marks
        return self.own_marks


@dataclass
class Section:
    label: str
    declared_marks: Optional[int]
    instructions: str
    choice_answer: Optional[int] = None  # "attempt ANY THREE" -> 3
    questions: list[Question] = field(default_factory=list)


@dataclass
class ParsedPaper:
    sections: list[Section]
    duration_text: Optional[str]
    unit_code: Optional[str]
    unit_title: Optional[str]
    issues: list[str]  # structural: the parser could not read something
    notes: list[str] = field(default_factory=list)  # trainer errors: marks that do not add up

    def to_dict(self) -> dict:
        return asdict(self)


LOOSE_END_RE = re.compile(r"[\(\[]?\s*(\d{1,2})\s*(?:marks?|mks?)\s*[\)\]]?\s*[.;:]?\s*$", re.I)


def _last_mark(text: str) -> Optional[int]:
    """Marks in brackets anywhere, or - for typos such as "(4 Marks" and
    "5marks)" - a marks token at the very end of the text."""
    found = MARK_RE.findall(text)
    if found:
        return int(found[-1])
    m = LOOSE_END_RE.search(text.strip())
    return int(m.group(1)) if m else None


def _strip_marks(text: str) -> str:
    text = MARK_RE.sub("", text)
    text = LOOSE_END_RE.sub("", text.strip())
    return re.sub(r"\s+", " ", text).strip()


def _choice_from(text: str) -> Optional[int]:
    """How many questions must be answered. 'ALL' -> None (answer everything)."""
    pats = [
        r"\b(?:attempt|answer|choose|select)\s+(?:any\s+)?(\w+)\s*(?:\(\d\)\s*)?(?:questions?|of|from)\b",
        r"\bany\s+(\w+)\s*(?:\(\d\)\s*)?(?:of|from|questions?)\b",
    ]
    for pat in pats:
        for m in re.finditer(pat, text, re.I):
            n = WORDNUM.get(m.group(1).lower())
            if n:
                return n
    return None


def _find_sections(lines: list[str]) -> list[tuple[int, str, str]]:
    """Return (line_index, label, rest_of_heading) for real section headings.

    A cover page can mention "SECTION B" in its instructions. A heading only
    counts if at least one numbered question follows it before the next heading.
    """
    cands = []
    for i, line in enumerate(lines):
        m = SECTION_RE.match(line)
        if m:
            cands.append((i, m.group(1).upper(), m.group(2)))
    real = []
    for k, (i, label, rest) in enumerate(cands):
        end = cands[k + 1][0] if k + 1 < len(cands) else len(lines)
        if any(NUM_RE.match(lines[j]) for j in range(i + 1, end)):
            real.append((i, label, rest))
    return real


def parse_paper(text: str) -> ParsedPaper:
    lines = [l.rstrip() for l in text.splitlines()]
    issues: list[str] = []
    head = "\n".join(lines[:60])

    dur = re.search(r"TIME\s*[:\-]?\s*([0-9.]+\s*(?:hours?|hrs?|minutes?|mins?)(?:\s*(?:and|&)?\s*\d+\s*min\w*)?)", head, re.I)
    code = re.search(r"\b([A-Z]{2,4})\s?-?\s?(\d{4})\b", head)
    unit_code = f"{code.group(1)} {code.group(2)}" if code else None
    unit_title = None
    if code:
        idx = next((i for i, l in enumerate(lines[:60]) if code.group(0) in l), None)
        if idx is not None:
            for j in range(idx - 1, max(idx - 6, -1), -1):
                cand = lines[j].strip()
                if cand and not re.search(r"examination|department|college|logo|\.png|series|jan|sep|may", cand, re.I):
                    unit_title = cand
                    break

    heads = _find_sections(lines)
    if not heads:
        issues.append("no section headings found")
        return ParsedPaper([], dur.group(1) if dur else None, unit_code, unit_title, issues, [])

    sections: list[Section] = []
    for k, (start, label, rest) in enumerate(heads):
        end = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
        body = lines[start + 1:end]
        declared = _last_mark(rest) or None
        dm = re.search(r"(\d{1,3})\s*marks?", rest, re.I)
        if dm:
            declared = int(dm.group(1))
        instr_lines, qlines = [], []
        seen_q = False
        for l in body:
            if not seen_q and NUM_RE.match(l):
                seen_q = True
            (qlines if seen_q else instr_lines).append(l)
        instructions = " ".join(x.strip() for x in instr_lines if x.strip())
        if declared is None:
            dm = re.search(r"\((\d{1,3})\s*marks?\)", instructions, re.I)
            declared = int(dm.group(1)) if dm else None
        sec = Section(label, declared, instructions, _choice_from(rest + " " + instructions))
        _parse_questions(qlines, sec, issues)
        sections.append(sec)
    structural, notes = validate(sections)
    return ParsedPaper(sections, dur.group(1) if dur else None, unit_code, unit_title, issues + structural, notes)


def _parse_questions(lines: list[str], sec: Section, issues: list[str]) -> None:
    cur_q: Optional[Question] = None
    stack: list[Part] = []  # open part chain under cur_q
    last_letter = ""
    target = None  # node receiving continuation text

    def append(node, line):
        node.text = (node.text + " " + line.strip()).strip()

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        m = NUM_RE.match(raw)
        if m:
            cur_q = Question(int(m.group(1)), m.group(2).strip())
            sec.questions.append(cur_q)
            stack, last_letter, target = [], "", cur_q
            inline = LABEL_RE.match(cur_q.text)
            if inline and inline.group(1).lower() == "a" and cur_q.text.lstrip().startswith(("(", "a)")):
                cur_q.text = ""
                part = Part("a", "letter", inline.group(2).strip())
                cur_q.parts.append(part)
                stack, last_letter, target = [part], "a", part
            continue
        if cur_q is None:
            continue
        lm = LABEL_RE.match(raw)
        if lm:
            raw_lab = lm.group(1)
            lab = raw_lab.lower()
            is_roman = lab in ROMAN and not (lab == "i" and last_letter == "h") and lab not in {"v", "x"} or lab in {"ii", "iii", "iv", "vi", "vii", "viii", "ix"}
            if lab in {"v", "x"} and stack and stack[-1].kind == "letter":
                is_roman = True
            kind = "roman" if is_roman else "letter"
            part = Part(lab, kind, lm.group(2).strip())
            part.upper = raw_lab.isupper() and len(raw_lab) == 1
            if kind == "letter":
                container = cur_q.parts
                stack = [part]
                last_letter = lab
            else:
                parent = next((p for p in reversed(stack) if p.kind == "letter"), None)
                if parent is None:  # roman without a letter parent: attach to question
                    container = cur_q.parts
                    stack = [part]
                else:
                    container = parent.parts
                    stack = [parent, part]
            container.append(part)
            target = part
            continue
        if BOILERPLATE.match(line) and not MARK_RE.search(line):
            continue
        if target is not None:
            append(target, line)

    # finalise marks
    for q in sec.questions:
        q.own_marks = _last_mark(q.text)
        q.text = _strip_marks(q.text)
        for p in _walk(q.parts):
            p.own_marks = _last_mark(p.text)
            p.text = _strip_marks(p.text)
        if len(q.parts) >= 3 and all(p.upper and p.own_marks is None for p in q.parts):
            q.kind = "mcq"
    mcq = [q for q in sec.questions if q.kind == "mcq"]
    if mcq and sec.declared_marks and len(mcq) == len(sec.questions):
        each, rem = divmod(sec.declared_marks, len(mcq))
        for q in mcq:
            q.own_marks = each if rem == 0 else None


def _walk(parts):
    for p in parts:
        yield p
        yield from _walk(p.parts)


def validate(sections: list[Section]) -> tuple[list[str], list[str]]:
    """Return (structural issues, trainer notes).

    Structural issues mean the parser could not read part of the paper.
    Trainer notes mean the paper was read fine but its marks do not match the
    college standard (Section A = 40, Section B = 60). Those are the trainer's
    errors; they never block a paper from being used.
    """
    issues: list[str] = []
    notes: list[str] = []
    labels = {s.label for s in sections}
    for need in ("A", "B"):
        if need not in labels:
            notes.append(f"section {need} not found (non-standard layout)")
    for s in sections:
        if not s.questions:
            issues.append(f"section {s.label}: no questions")
            continue
        missing = [q.number for q in s.questions if q.total() is None]
        if missing:
            issues.append(f"section {s.label}: marks not found for question(s) {missing}")
            continue
        totals = [q.total() for q in s.questions]
        standard = STANDARD_MARKS.get(s.label)
        choice = s.choice_answer or STANDARD_CHOICE.get(s.label)
        if choice and len(set(totals)) == 1:
            got = choice * totals[0]
        elif choice:
            notes.append(f"section {s.label}: questions carry unequal marks {totals}")
            continue
        else:
            got = sum(value for value in totals if value is not None)
        if standard is not None and got != standard:
            notes.append(f"section {s.label}: adds to {got}, standard is {standard}")
        if s.choice_answer and STANDARD_CHOICE.get(s.label) and s.choice_answer != STANDARD_CHOICE[s.label]:
            notes.append(f"section {s.label}: says answer {s.choice_answer}, standard is {STANDARD_CHOICE[s.label]}")
        for q in s.questions:
            if q.parts and q.own_marks is not None and q.kind != "mcq" and q.own_marks != q.total():
                notes.append(f"section {s.label} Q{q.number}: stem says {q.own_marks}, parts add to {q.total()}")
    return issues, notes
