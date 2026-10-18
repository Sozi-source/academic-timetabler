"""Flatten parsed papers into reference questions.

Reference questions are *style and structure examples* for the generator. They
are never inserted into a new paper as they are.

    python -m exam_engine.bank out/papers.jsonl --out out/questions.jsonl
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

LEAD = re.compile(r"^[\W\d_]*([A-Za-z]+)")


def command_word(text: str) -> str | None:
    m = LEAD.match(text.strip())
    return m.group(1).lower() if m else None


def _parts(parts: list[dict]) -> list[dict]:
    out = []
    for p in parts:
        total = p.get("own_marks")
        if p["parts"]:
            sub = [x.get("own_marks") for x in p["parts"]]
            if all(v is not None for v in sub):
                total = sum(sub)
        out.append({"label": p["label"], "text": p["text"], "marks": total,
                    "parts": _parts(p["parts"])})
    return out


def _qtotal(q: dict) -> int | None:
    if q["kind"] == "mcq" or not q["parts"]:
        return q["own_marks"]
    tot = []
    for p in q["parts"]:
        t = p["own_marks"]
        if p["parts"]:
            sub = [x["own_marks"] for x in p["parts"]]
            t = sum(sub) if all(v is not None for v in sub) else t
        tot.append(t)
    return sum(t for t in tot if t is not None) if any(t is not None for t in tot) else q["own_marks"]


def flatten(rec: dict) -> list[dict]:
    paper, meta = rec["paper"], rec["meta"]
    rows = []
    for sec in paper["sections"]:
        for q in sec["questions"]:
            words = len(q["text"].split())
            # Case studies open with a scenario; the command word is in part (a).
            first = q["parts"][0]["text"] if (q["parts"] and words > 25) else (q["text"] or (q["parts"][0]["text"] if q["parts"] else ""))
            if q["kind"] == "mcq":
                qtype = "mcq"
            elif sec["label"] == "B" or (q["parts"] and words > 25):
                qtype = "case_study" if words > 25 else "structured"
            else:
                qtype = "short_answer" if not q["parts"] else "structured"
            rows.append({
                "unit_code": paper["unit_code"], "unit_title": paper["unit_title"],
                "year": meta["year"], "series": meta["series"], "trainer": meta["trainer"],
                "paper_kind": meta["paper_kind"], "section": sec["label"], "number": q["number"],
                "question_type": qtype, "command_word": command_word(first),
                "marks": _qtotal(q), "stem": q["text"], "parts": _parts(q["parts"]),
                "source_path": meta["path"],
            })
    return rows


def run(papers_jsonl: Path, out: Path) -> dict:
    stats = {"papers": 0, "questions": 0, "by_section": {}, "by_type": {}, "units": set()}
    with open(papers_jsonl, encoding="utf-8") as f, open(out, "w", encoding="utf-8") as o:
        for line in f:
            rec = json.loads(line)
            if not rec["status"].startswith("usable"):
                continue
            stats["papers"] += 1
            for row in flatten(rec):
                o.write(json.dumps(row, ensure_ascii=False) + "\n")
                stats["questions"] += 1
                stats["by_section"][row["section"]] = stats["by_section"].get(row["section"], 0) + 1
                stats["by_type"][row["question_type"]] = stats["by_type"].get(row["question_type"], 0) + 1
                if row["unit_code"]:
                    stats["units"].add(row["unit_code"])
    stats["units"] = len(stats["units"])
    return stats


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("papers_jsonl", type=Path)
    ap.add_argument("--out", type=Path, default=Path("questions.jsonl"))
    args = ap.parse_args(argv)
    print(json.dumps(run(args.papers_jsonl, args.out), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
