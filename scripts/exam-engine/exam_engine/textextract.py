"""Turn an uploaded document into plain text with Word auto-numbering resolved.

Past papers use Word's automatic list numbering, so "1.", "a)", "i." are not
stored as text in the .docx. pandoc renders them, which is why it is used here
instead of reading paragraphs directly.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


class ExtractionError(RuntimeError):
    pass


def extract_text(path: str | Path, timeout: int = 90) -> str:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return _run(["pandoc", str(path), "-t", "plain", "--wrap=none"], timeout)
    if suffix == ".doc":
        # Legacy format: convert via LibreOffice if available.
        soffice = shutil.which("soffice") or shutil.which("libreoffice")
        if not soffice:
            raise ExtractionError(".doc needs LibreOffice installed to convert")
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            _run([soffice, "--headless", "--convert-to", "docx", "--outdir", tmp, str(path)], timeout)
            return extract_text(Path(tmp) / (path.stem + ".docx"), timeout)
    if suffix == ".pdf":
        return _run(["pdftotext", "-layout", str(path), "-"], timeout)
    raise ExtractionError(f"unsupported file type: {suffix}")


def _run(cmd: list[str], timeout: int) -> str:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as exc:
        raise ExtractionError(f"{cmd[0]} is not installed") from exc
    except subprocess.TimeoutExpired as exc:
        raise ExtractionError(f"{cmd[0]} timed out") from exc
    if proc.returncode != 0:
        raise ExtractionError(proc.stderr.strip()[:300] or f"{cmd[0]} failed")
    return proc.stdout
