from dataclasses import dataclass
from typing import Any

@dataclass
class Source:
    id: str
    title: str
    source_type: str
    storage_bucket: str | None
    storage_path: str | None
    content_text: str | None
    original_filename: str | None
    ingested_at: str | None

@dataclass
class Job:
    id: str
    trainer_id: str
    unit_id: str
    topic: str | None
    status: str
    teaching_allocation_id: str | None
    department_id: str | None
