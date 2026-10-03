from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from .config import NOTES_ENGINE_TOKEN
from .db import supabase

app = FastAPI(title="Academic Notes Consolidation Engine", version="1.0.0")

class EnqueueRequest(BaseModel):
    job_id: str


def auth(token: str | None):
    if not token or token != NOTES_ENGINE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid notes engine token")

@app.get("/health")
def health():
    return {"ok": True, "service": "notes-engine", "engine": "python"}

@app.post("/v1/jobs/unified/enqueue", status_code=202)
def enqueue(request: EnqueueRequest, x_notes_engine_token: str | None = Header(default=None)):
    auth(x_notes_engine_token)
    job = supabase.table("lecture_note_jobs").select("id,status,generation_engine").eq("id", request.job_id).single().execute().data
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("generation_engine") != "python":
        raise HTTPException(status_code=409, detail="Job is not assigned to the Python notes engine")
    if job.get("status") == "done":
        return {"jobId": request.job_id, "status": "done"}
    supabase.table("lecture_note_jobs").update({"status": "pending", "error_message": None}).eq("id", request.job_id).execute()
    return {"jobId": request.job_id, "status": "pending"}
