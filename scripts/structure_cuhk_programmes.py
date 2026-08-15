#!/usr/bin/env python3
"""Structure CUHK 2024 undergraduate study-scheme captures as JSON.

The input is the verbatim text saved from the official CUSIS programme pages.
Parsing is deliberately conservative: normalized course codes are accompanied
by page-text evidence, and the complete source text is preserved for audits.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "data/cuhk/2024/programmes"
OUTPUT_DIR = ROOT / "data/cuhk/2024/json/programmes"
AGGREGATE = ROOT / "data/cuhk/2024/json/programmes-2024.json"
REUSE_MANIFEST = ROOT / "data/cuhk/2024/reused-duplicate-programme-details.json"

FULL_CODE_RE = re.compile(r"\b([A-Z]{2,6})(\d{4})([A-Z]?)\b")
TOKEN_RE = re.compile(r"\b([A-Z]{2,6}\d{4}[A-Z]?|\d{4}[A-Z]?)\b")
SUBJECT_ALIAS_RE = re.compile(r"\b([A-Z]{2,6})\[([A-Z]{2,6})\](\d{4}[A-Z]?)\b")
COURSE_ALIAS_RE = re.compile(
    r"\b([A-Z]{2,6})(\d{4}[A-Z]?)\s*\[([#*]?)(?:([A-Z]{2,6})\s*)?(\d{4}[A-Z]?)\]"
)
MIN_UNITS_RE = re.compile(
    r"(?:minimum of|complete)\s+([^\n.]{0,100}?\bunits?\b)", re.IGNORECASE
)
ADMISSION_RE = re.compile(r"Applicable to students admitted in\s+([^\n]+)", re.IGNORECASE)
SECTION_RE = re.compile(
    r"(?m)^(\d+)\.\s*\n+\s*([^\n:]{2,100}:?)\s*\n+(.*?)(?=^\d+\.\s*$|\Z)",
    re.DOTALL,
)
UNITS_LINE_RE = re.compile(r"(?m)^\s*(\d+(?:-\d+)?)\s*$")


def filename_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")[:120]


def clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\r", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def extract_course_mentions(text: str) -> list[dict]:
    mentions: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for line in text.splitlines():
        normalized_line = SUBJECT_ALIAS_RE.sub(lambda m: f"{m.group(1)}{m.group(3)}", line)
        current_prefix: str | None = None
        bracket_spans = [m.span() for m in re.finditer(r"\[[^\]]*\]", normalized_line)]
        for token_match in TOKEN_RE.finditer(normalized_line):
            token = token_match.group(1)
            if any(start <= token_match.start() < end for start, end in bracket_spans):
                continue
            full = FULL_CODE_RE.fullmatch(token)
            inferred = False
            if full:
                current_prefix = full.group(1)
                code = token
            elif current_prefix:
                before = normalized_line[max(0, token_match.start() - 40):token_match.start()]
                after = normalized_line[token_match.end():token_match.end() + 30]
                level_context = token.startswith(tuple("12345")) and token[1:4] == "000" and (
                    re.search(r"\bcourses?\b[^.;:]{0,25}$", before, re.I)
                    and re.search(r"\blevel\b", after, re.I)
                )
                if level_context or after.startswith("-") or re.search(r"(?:\bat|\bcoded\s+at)\s*$", before, re.I) or re.match(
                    r"\s*(?:or|and)\s+above\s+level\b|\s*level\b", after, re.I
                ):
                    continue
                code = current_prefix + token
                inferred = True
            else:
                continue
            key = (code, line)
            if key in seen:
                continue
            seen.add(key)
            mentions.append(
                {
                    "course_code": code,
                    "prefix_inferred": inferred,
                    "evidence": line,
                }
            )
    return mentions


def extract_course_aliases(text: str) -> list[dict]:
    aliases: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for line in text.splitlines():
        for match in SUBJECT_ALIAS_RE.finditer(line):
            new_prefix, old_prefix, number = match.groups()
            item = (new_prefix + number, old_prefix + number, line)
            if item not in seen:
                seen.add(item)
                aliases.append({
                    "current_course_code": item[0], "former_course_code": item[1],
                    "notation": "subject_prefix_in_brackets", "evidence": line,
                })
        for match in COURSE_ALIAS_RE.finditer(line):
            new_prefix, new_number, marker, old_prefix, old_number = match.groups()
            old_code = (old_prefix or new_prefix) + old_number
            item = (new_prefix + new_number, old_code, line)
            if item not in seen:
                seen.add(item)
                aliases.append({
                    "current_course_code": item[0], "former_course_code": item[1],
                    "notation": {"#": "hash_bracket", "*": "asterisk_bracket"}.get(marker, "plain_bracket"),
                    "evidence": line,
                })
    return aliases


def parse_sections(study_text: str) -> list[dict]:
    sections = []
    for match in SECTION_RE.finditer(study_text):
        number, title, body = match.groups()
        body = body.strip()
        units = None
        units_match = UNITS_LINE_RE.search(body)
        if units_match:
            units = units_match.group(1)
        sections.append(
            {
                "number": int(number),
                "title": title.rstrip(":"),
                "units_as_printed": units,
                "course_mentions": extract_course_mentions(body),
                "raw_text": body,
            }
        )
    return sections


def parse_programme(path: Path, reused: dict[tuple[str, str], dict]) -> dict:
    raw_text = path.read_text(encoding="utf-8", errors="replace")
    text = clean_text(raw_text)
    program_match = re.search(r"Academic Program:\s*([^\n]+)", text)
    year_match = re.search(r"Academic Year:\s*(\d{4})", text)
    programme = program_match.group(1).strip() if program_match else path.stem.split("__")[0]
    faculty = path.stem.split("__", 1)[1].replace("_", " ") if "__" in path.stem else None
    academic_year = int(year_match.group(1)) if year_match else 2024
    study_start = text.find("Major Programme Requirement")
    study_text = text[study_start:] if study_start >= 0 else text
    admission = ADMISSION_RE.search(text)
    minimum_units = MIN_UNITS_RE.search(study_text)
    source_note = reused.get((programme, faculty))
    return {
        "programme_id": path.stem,
        "academic_program": programme,
        "faculty": faculty,
        "academic_year": academic_year,
        "admission_cohort": admission.group(1).strip() if admission else None,
        "requirement_summary": {
            "minimum_units_as_printed": minimum_units.group(1).strip() if minimum_units else None,
            "sections": parse_sections(study_text),
        },
        "all_course_mentions": extract_course_mentions(study_text),
        "course_code_aliases": extract_course_aliases(study_text),
        "source": {
            "system": "CUHK CUSIS Browse Program Information",
            "url": "https://rgsntl.rgs.cuhk.edu.hk/aqs_prd_applx/Public/tt_dsp_acad_prog.aspx",
            "source_text_file": str(path.relative_to(ROOT)),
            "reused_duplicate_entry": bool(source_note),
            "reused_from_faculty": source_note.get("reusedFrom") if source_note else None,
        },
        "raw_text": raw_text,
    }


def main() -> None:
    reused: dict[tuple[str, str], dict] = {}
    if REUSE_MANIFEST.exists():
        for row in json.loads(REUSE_MANIFEST.read_text(encoding="utf-8")).get("records", []):
            reused[(row["programme"], row["faculty"])] = row

    paths = sorted(INPUT_DIR.glob("*.txt"))
    programmes = [parse_programme(path, reused) for path in paths]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for item in programmes:
        out = OUTPUT_DIR / f"{filename_part(item['programme_id'])}.json"
        out.write_text(json.dumps(item, ensure_ascii=False, indent=2), encoding="utf-8")

    aggregate = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "academic_year": 2024,
        "programme_count": len(programmes),
        "validation_notes": [
            "Course codes with prefix_inferred=true inherit the most recent alphabetic prefix on the same evidence line.",
            "Always use evidence and raw_text when exact course-code fidelity is critical.",
            "Duplicate faculty listings reused from an identical programme detail are explicitly marked in source.",
        ],
        "programmes": programmes,
    }
    AGGREGATE.parent.mkdir(parents=True, exist_ok=True)
    AGGREGATE.write_text(json.dumps(aggregate, ensure_ascii=False, indent=2), encoding="utf-8")
    print(AGGREGATE)


if __name__ == "__main__":
    main()
