from __future__ import annotations

import os
import socket
import time
import traceback
from .db import supabase
from .service import process_job

WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"
POLL_SECONDS = float(os.getenv("ENGINE_POLL_SECONDS", "3"))


def claim_job():
    response = supabase.rpc("claim_next_python_lecture_note_job", {"p_worker_id": WORKER_ID}).execute()
    return response.data[0] if response.data else None


def main():
    print(f"notes-engine worker started: {WORKER_ID}")
    while True:
        try:
            job = claim_job()
            if job:
                print(f"processing job {job['id']}")
                process_job(job["id"])
            else:
                time.sleep(POLL_SECONDS)
        except KeyboardInterrupt:
            print("worker stopped")
            return
        except Exception:
            traceback.print_exc()
            time.sleep(POLL_SECONDS)

if __name__ == "__main__":
    main()
