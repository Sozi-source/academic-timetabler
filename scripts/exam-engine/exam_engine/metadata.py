"""Derive sitting metadata from the folder layout teachers already use.

Folder naming is inconsistent (PP1 / PP 1 / PAPER 1 / pp1; "Marking scheme" in
six spellings), so everything is matched case-insensitively and loosely.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from pathlib import PurePosixPath
from typing import Optional

SERIES = {"JAN-APRIL": "JAN-APR", "JAN-APRIL.": "JAN-APR", "JAN-APR": "JAN-APR",
          "MAY-AUG": "MAY-AUG", "SEP-DEC": "SEP-DEC", "SEPT-DEC": "SEP-DEC"}
SKIP = re.compile(r"^(~\$|desktop\.ini$|thumbs\.db$)", re.I)


@dataclass
class SourceMeta:
    path: str
    year: Optional[int]
    series: Optional[str]
    trainer: Optional[str]
    doc_kind: str  # 'paper' | 'scheme' | 'outline'
    paper_kind: Optional[str]  # 'main' | 'supplementary' | None (unknown)

    def to_dict(self) -> dict:
        return asdict(self)


def is_skippable(filename: str) -> bool:
    return bool(SKIP.match(filename))


def classify(rel_path: str) -> SourceMeta:
    parts = PurePosixPath(rel_path.replace("\\", "/")).parts
    low = rel_path.lower().replace("\\", "/")
    year = next((int(p) for p in parts if re.fullmatch(r"20\d\d", p)), None)
    series = next((SERIES[p.upper()] for p in parts if p.upper() in SERIES), None)

    trainer = None
    folders = parts[:-1]
    for i, seg in enumerate(folders):
        if re.fullmatch(r"20\d\d", seg) or seg.upper() in SERIES:
            continue
        if re.search(r"pp ?[12]|paper ?[12]|marking|mark scheme|outline|sample", seg, re.I):
            continue
        trainer = seg.title()
        break

    if re.search(r"marking|mark scheme|\bms\b", low):
        doc_kind = "scheme"
    elif "outline" in low:
        doc_kind = "outline"
    else:
        doc_kind = "paper"

    if re.search(r"\bpp ?2\b|paper ?2\b|supp", low):
        paper_kind = "supplementary"
    elif re.search(r"\bpp ?1\b|paper ?1\b", low):
        paper_kind = "main"
    else:
        paper_kind = None
    return SourceMeta(rel_path, year, series, trainer, doc_kind, paper_kind)
