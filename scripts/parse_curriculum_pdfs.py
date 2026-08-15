#!/usr/bin/env python3
"""Convert curriculum PDFs to conservative, machine-readable JSON.

The parser preserves page-level raw text and records extraction quality rather
than guessing text from image-only pages.  Course codes are normalised only as
mentions; their surrounding evidence remains in `pages` for verification.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
INPUTS = [
    ROOT / "data/curriculum/CUHK-Business-School-Guidelines-2026-27.pdf",
]
OUTPUT = ROOT / "data/curriculum/json/business-school-guidelines-2026-27.json"
COURSE_RE = re.compile(r"\b([A-Z]{2,6}\s?\d{3,4}[A-Z]?)\b")
HEADING_RE = re.compile(r"^(?:[A-Z]\.|App\.\s*\d+|Appendix\s*\d+|[A-Z][^.]{0,90})$")


def normalise_course(code: str) -> str:
    return re.sub(r"\s+", "", code)


def parse_pdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    pages = []
    course_mentions = []
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = (page.extract_text() or "").strip()
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            headings = [line for line in lines if HEADING_RE.fullmatch(line)]
            codes = sorted({normalise_course(match) for match in COURSE_RE.findall(text)})
            for code in codes:
                course_mentions.append({"course_code": code, "page": page_number})
            pages.append(
                {
                    "page": page_number,
                    "text": text,
                    "headings": headings,
                    "course_codes": codes,
                    "extraction_status": "text_extracted" if text else "image_or_unextractable",
                }
            )

    metadata = reader.metadata or {}
    image_only = [page["page"] for page in pages if not page["text"]]
    return {
        "source_file": str(path.relative_to(ROOT)),
        "source_sha_note": "Verify course codes against the page-level raw text before use.",
        "metadata": {
            "title": metadata.get("/Title") or None,
            "author": metadata.get("/Author") or None,
            "producer": metadata.get("/Producer") or None,
            "page_count": len(pages),
        },
        "extraction": {
            "method": "pdfplumber_text_layer",
            "quality": "needs_ocr" if image_only else "text_layer_available",
            "pages_needing_ocr": image_only,
        },
        "course_mentions": course_mentions,
        "pages": pages,
    }


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Machine-readable source extraction for the CUHK Business School 2026-27 guideline.",
        "documents": [parse_pdf(path) for path in INPUTS],
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
