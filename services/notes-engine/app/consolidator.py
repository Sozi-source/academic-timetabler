from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable

@dataclass
class Section:
    heading: str
    paragraphs: list[str]

@dataclass
class ConsolidationResult:
    sections: list[Section]
    source_materials: list[str]
    source_word_count: int
    retained_word_count: int
    duplicate_paragraph_count: int


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", clean_text(value).lower())).strip()


def word_count(value: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+", value))


def looks_like_heading(value: str) -> bool:
    text = clean_text(value)
    if not text or len(text) > 180:
        return False
    # Numbered assessment questions and instructions are content, not headings.
    if "?" in text:
        return False
    if re.match(r"^\d+[.)]?\s+(calculate|define|explain|describe|discuss|state|list|outline|identify|give|what|why|how)\b", text, re.I):
        return False
    if re.match(r"^\d+[.)]?\s+", text) and ":" in text and len(text.split()) > 12:
        return False
    if re.match(r"^\d+[.)]?\s+", text) and text.endswith(".") and len(text.split()) > 8:
        return False
    if text.count(".") >= 2 and len(text.split()) > 14:
        return False
    patterns = (
        r"^(lesson|module|chapter|unit)\s+\d+",
        r"^\d+(\.\d+)*[.)]?\s+[A-Za-z]",
        r"^[A-Z][A-Z0-9 &/(),:'’\-–—]{5,}$",
        r"^(learning objectives|introduction|key definitions|lesson summary|references|further reading|assessment|summary|conclusion)$",
    )
    return any(re.match(pattern, text, re.I) for pattern in patterns)


def heading_key(value: str) -> str:
    key = normalize(value)
    key = re.sub(r"^(lesson|module|chapter|unit)\s+\d+(?:\.\d+)*\s*", "", key)
    key = re.sub(r"^\d+(?:\.\d+)*\s*", "", key)
    return key


def heading_order(value: str):
    normalized = normalize(value)
    match = re.search(r"\b(?:lesson|module|chapter|unit)\s+(\d+(?:\.\d+)*)", normalized)
    if match:
        return (0, tuple(int(x) for x in match.group(1).split(".")), normalized)
    match = re.match(r"^(\d+(?:\.\d+)*)\s", normalized)
    if match:
        return (0, tuple(int(x) for x in match.group(1).split(".")), normalized)
    return (1, (), normalized)


def equivalent_heading(a: str, b: str) -> bool:
    ka, kb = heading_key(a), heading_key(b)
    if ka == kb:
        return True
    if len(ka) > 12 and len(kb) > 12 and SequenceMatcher(None, ka, kb).ratio() >= 0.93:
        return True
    return False


def extract_paragraphs(source_name: str, text: str) -> list[tuple[str, str]]:
    current = "Additional Source Content"
    result: list[tuple[str, str]] = []
    for raw in re.split(r"\n+", text):
        line = clean_text(raw)
        if not line:
            continue
        if line.startswith("SOURCE FILE:"):
            # Keep ZIP member traceability but don't make every member a top-level section.
            result.append((current, line))
            continue
        if looks_like_heading(line):
            current = line
        else:
            result.append((current, line))
    return result


def consolidate(sources: Iterable[tuple[str, str]]) -> ConsolidationResult:
    # sources = (display title, complete extracted text)
    heading_reps: list[str] = []
    groups: dict[str, Section] = {}
    source_materials: list[str] = []
    seen: set[str] = set()
    source_word_count = 0
    retained_word_count = 0
    duplicate_count = 0

    for title, raw_text in sources:
        source_materials.append(title)
        text = clean_text(raw_text)
        source_word_count += word_count(text)
        for heading, paragraph in extract_paragraphs(title, text):
            if looks_like_heading(heading):
                representative = next((h for h in heading_reps if equivalent_heading(h, heading)), None)
                if representative is None:
                    heading_reps.append(heading)
                    representative = heading
            else:
                representative = heading
                if representative not in groups:
                    heading_reps.append(representative)

            key = heading_key(representative) or "additional source content"
            if key not in groups:
                groups[key] = Section(representative, [])
            normalized = normalize(paragraph)
            if len(normalized) < 4:
                continue
            if normalized in seen:
                duplicate_count += 1
                continue
            seen.add(normalized)
            groups[key].paragraphs.append(paragraph)
            retained_word_count += word_count(paragraph)

    sections = [groups[key] for key in sorted(groups, key=lambda k: heading_order(groups[k].heading)) if groups[key].paragraphs]
    return ConsolidationResult(
        sections=sections,
        source_materials=source_materials,
        source_word_count=source_word_count,
        retained_word_count=retained_word_count,
        duplicate_paragraph_count=duplicate_count,
    )
