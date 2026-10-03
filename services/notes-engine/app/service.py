from __future__ import annotations

import json
import time
import traceback
from datetime import datetime, timezone
from .db import supabase
from .extract import extract_material
from .consolidator import consolidate
from .exporters import build_docx, build_pdf, safe_filename

BUCKET = "lecture-notes"


def _job_row(job_id: str):
    response = supabase.table("lecture_note_jobs").select("*").eq("id", job_id).single().execute()
    return response.data


def _load_ready_materials(unit_id: str, trainer_id: str):
    response = (supabase.table("lecture_materials")
                .select("id,title,source_type,storage_bucket,storage_path,content_text,original_filename,ingested_at")
                .eq("unit_id", unit_id)
                .eq("trainer_id", trainer_id)
                .not_.is_("ingested_at", "null")
                .order("created_at", desc=False)
                .execute())
    return response.data or []


def _unit(unit_id: str):
    response = supabase.table("units").select("code,name").eq("id", unit_id).single().execute()
    return response.data


def _download_source(material: dict) -> bytes | None:
    path = material.get("storage_path")
    bucket = material.get("storage_bucket") or BUCKET
    if not path:
        return None
    result = supabase.storage.from_(bucket).download(path)
    return bytes(result)


def process_job(job_id: str) -> None:
    try:
        job = _job_row(job_id)
        if not job:
            return
        unit = _unit(job["unit_id"])
        if not unit:
            raise RuntimeError("Unit was not found.")
        materials = _load_ready_materials(job["unit_id"], job["trainer_id"])
        if not materials:
            raise RuntimeError("No Ready source materials are available for this unit.")

        sources = []
        for material in materials:
            # content_text is already the complete extraction produced by ingestion.
            # For ZIP and other sources, fall back to the original object so this service
            # can independently re-extract if content_text is unavailable.
            extracted = extract_material(
                material["title"], material["source_type"],
                _download_source(material) if not material.get("content_text") else None,
                material.get("content_text"),
            )
            sources.extend(extracted)

        result = consolidate(sources)
        topic = job.get("topic") or "Full Unit"
        docx = build_docx(unit["code"], unit["name"], topic, result)
        pdf = build_pdf(unit["code"], unit["name"], topic, result)
        stamp = int(time.time() * 1000)
        base = f"generated/{job['trainer_id']}/{job['unit_id']}/{job_id}/{stamp}"
        docx_path = f"{base}.docx"
        pdf_path = f"{base}.pdf"
        supabase.storage.from_(BUCKET).upload(docx_path, docx, {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "upsert": True})
        supabase.storage.from_(BUCKET).upload(pdf_path, pdf, {"content-type": "application/pdf", "upsert": True})
        result_json = {
            "sections": [{"heading": s.heading, "body": "\n\n".join(s.paragraphs)} for s in result.sections],
            "sourceMaterials": result.source_materials,
            "materialCount": len(result.source_materials),
            "sourceWordCount": result.source_word_count,
            "retainedWordCount": result.retained_word_count,
            "duplicateParagraphCount": result.duplicate_paragraph_count,
            "generationMode": "unified",
        }
        supabase.table("lecture_note_jobs").update({
            "status": "done",
            "docx_storage_bucket": BUCKET,
            "docx_storage_path": docx_path,
            "pdf_storage_bucket": BUCKET,
            "pdf_storage_path": pdf_path,
            "result_json": result_json,
            "output_token_count": 0,
            "prompt_token_count": 0,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "error_message": None,
        }).eq("id", job_id).execute()
    except Exception as exc:
        traceback.print_exc()
        supabase.table("lecture_note_jobs").update({
            "status": "error",
            "error_message": str(exc)[:4000],
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()
