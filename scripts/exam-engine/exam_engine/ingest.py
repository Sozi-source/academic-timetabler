"""Import a folder tree of past papers.

    python -m exam_engine.ingest /path/to/2023 --out ./out

Writes:
  papers.jsonl   one parsed paper per line (structure, marks, issues)
  report.csv     one row per paper for human review (status, issues)

Nothing is ever deleted or modified in the source folder. A paper that cannot
be read is reported, never skipped silently.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from .metadata import classify, is_skippable
from .paper_parser import parse_paper
from .textextract import ExtractionError, extract_text

READABLE = {".docx", ".doc", ".pdf"}


def _process(root: Path, rel: str) -> dict:
    meta = classify(rel).to_dict()
    rec = {"meta": meta, "status": "ok", "error": None, "paper": None}
    try:
        text = extract_text(root / rel)
    except ExtractionError as exc:
        rec.update(status="unreadable", error=str(exc))
        return rec
    if meta["doc_kind"] != "paper":
        rec["status"] = f"ignored:{meta['doc_kind']}"
        return rec
    parsed = parse_paper(text)
    rec["paper"] = parsed.to_dict()
    if parsed.issues:
        rec["status"] = "unread_parts"  # the parser could not read something
    elif parsed.notes:
        rec["status"] = "usable_with_notes"  # read fine; trainer's marks are off
    else:
        rec["status"] = "usable"
    return rec


def run(root: Path, out: Path, workers: int = 8) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    rels = []
    for dirpath, _, files in os.walk(root):
        for f in files:
            if is_skippable(f) or Path(f).suffix.lower() not in READABLE:
                continue
            rels.append(os.path.relpath(os.path.join(dirpath, f), root))
    rels.sort()
    with ThreadPoolExecutor(workers) as ex:
        results = list(ex.map(lambda r: _process(root, r), rels))

    counts: dict[str, int] = {}
    with open(out / "papers.jsonl", "w", encoding="utf-8") as jf, \
         open(out / "report.csv", "w", newline="", encoding="utf-8") as cf:
        w = csv.writer(cf)
        w.writerow(["status", "year", "series", "trainer", "paper_kind", "unit_code", "unit_title", "could_not_read", "trainer_notes", "path"])
        for rec in results:
            counts[rec["status"]] = counts.get(rec["status"], 0) + 1
            jf.write(json.dumps(rec, ensure_ascii=False) + "\n")
            m, p = rec["meta"], rec["paper"] or {}
            w.writerow([rec["status"], m["year"], m["series"], m["trainer"], m["paper_kind"],
                        p.get("unit_code"), p.get("unit_title"),
                        " | ".join(p.get("issues", [])) or (rec["error"] or ""),
                        " | ".join(p.get("notes", [])), m["path"]])
    return counts


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", type=Path)
    ap.add_argument("--out", type=Path, default=Path("out"))
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args(argv)
    counts = run(args.root, args.out, args.workers)
    total = sum(counts.values())
    print(f"{total} files")
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {v:5d}  {k}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
