#!/usr/bin/env python3
"""Audit and normalize CUHK undergraduate programme requirements.

The official programme-page text remains the source of truth.  This script
adds conservative machine-readable hints and a review queue; it never turns an
ambiguous sentence into a definitive graduation rule.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/cuhk/2024/json/programmes-2024.json"
CURATED_SNAPSHOTS = sorted((ROOT / "data/cuhk-timetable/curated").glob("*/courses.csv"))
if not CURATED_SNAPSHOTS:
    raise FileNotFoundError("No curated timetable courses.csv snapshot found")
COURSES = CURATED_SNAPSHOTS[-1]
COURSE_INDEX_LABEL = COURSES.parent.name
OUT = ROOT / "data/cuhk/2024/clean"

FULL_CODE_RE = re.compile(r"\b([A-Z]{2,6})(\d{4})([A-Z]?)\b")
FOOTNOTE_RE = re.compile(r"\[([a-z0-9]+)\]", re.I)
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
                "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
CHOICE_RE = re.compile(
    r"\b(any\s+one|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
    r"(?:of\s+the\s+following\s+)?courses?\b", re.I
)


def compact(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def catalog_index() -> tuple[dict[str, dict], set[str]]:
    with COURSES.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return {row["course_code"]: row for row in rows}, {row["subject_code"] for row in rows}


def semantic_hints(evidence: str, section_title: str) -> dict:
    low = evidence.lower()
    codes = FULL_CODE_RE.findall(evidence)
    full_codes = ["".join(parts) for parts in codes]
    count_match = CHOICE_RE.search(evidence)
    choose_count = None
    if count_match:
        token = count_match.group(1).lower()
        choose_count = 1 if token == "any one" else NUMBER_WORDS.get(token)

    alternatives = "/" in evidence or bool(re.search(r"\bor\b", low))
    exclusions = bool(re.search(r"\b(exclud|except|not be counted|double count)", low))
    approval = bool(re.search(r"\b(permission|approval|consent)\b", low))
    level_pool = bool(re.search(r"\b(?:at|of)\s+[1234]000\s+or\s+above\b", low))
    level_match = re.search(r"\b([1234]000)\s+or\s+above\s+level\b", low)
    level_count_match = re.search(
        r"at\s+least\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+courses?\s+at\s+([1234]000)\s+or\s+above",
        low,
    )
    selection = bool(count_match or re.search(r"\b(selected from|choose|at least|among)\b", low))

    if selection:
        operator = "choose"
    elif alternatives:
        operator = "any_of"
    elif full_codes and "required" in section_title.lower():
        operator = "all_of"
    elif full_codes:
        operator = "listed_unspecified"
    else:
        operator = "text_constraint"

    return {
        "operator_hint": operator,
        "choose_count_hint": choose_count,
        "has_alternatives": alternatives,
        "has_exclusion_or_no_double_count": exclusions,
        "requires_approval_or_consent": approval,
        "has_level_based_pool": level_pool,
        "minimum_course_level": int(level_match.group(1)) if level_match else None,
        "minimum_courses_at_level": (
            int(level_count_match.group(1)) if level_count_match and level_count_match.group(1).isdigit()
            else NUMBER_WORDS.get(level_count_match.group(1)) if level_count_match else None
        ),
        "footnotes": sorted(set(FOOTNOTE_RE.findall(evidence))),
    }


def validation_for(code: str, inferred: bool, catalog: dict[str, dict], subjects: set[str], direct_codes: set[str]) -> tuple[str, str, str]:
    prefix = FULL_CODE_RE.fullmatch(code).group(1) if FULL_CODE_RE.fullmatch(code) else ""
    catalog_status = "matched_current_course_index" if code in catalog else (
        "subject_known_course_not_in_current_index" if prefix in subjects else "subject_not_in_current_index"
    )
    if code in catalog:
        return ("official_shorthand", "high", catalog_status) if inferred else ("directly_printed", "direct", catalog_status)
    if inferred and code in direct_codes:
        return "official_shorthand_corroborated", "high", catalog_status
    if inferred:
        return "official_shorthand", "high", catalog_status
    return "directly_printed", "direct", catalog_status


def main() -> None:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    programmes = payload["programmes"]
    catalog, subjects = catalog_index()
    direct_codes = {
        mention["course_code"]
        for programme in programmes
        for mention in programme.get("all_course_mentions", [])
        if not mention.get("prefix_inferred")
    }
    alias_pairs = {
        (alias["current_course_code"], alias["former_course_code"])
        for programme in programmes
        for alias in programme.get("course_code_aliases", [])
    }
    OUT.mkdir(parents=True, exist_ok=True)

    clean_programmes = []
    mention_rows = []
    review = []
    complex_rules = []
    validation_counts: Counter[str] = Counter()
    rule_counts: Counter[str] = Counter()
    reused_groups: dict[str, list[str]] = defaultdict(list)

    for programme in programmes:
        pid = programme["programme_id"]
        raw = programme.get("raw_text") or ""
        source = programme.get("source", {})
        if source.get("reused_duplicate_entry"):
            reused_groups[programme["academic_program"]].append(pid)
        if not raw.strip():
            review.append({
                "severity": "blocker", "type": "empty_source", "programme_id": pid,
                "evidence": "The captured source text is empty.",
                "recommended_action": "Recapture the official detail page or record that the faculty entry does not render."
            })

        sections = []
        for section in programme.get("requirement_summary", {}).get("sections", []):
            evidence_lines = [compact(line) for line in section.get("raw_text", "").splitlines() if compact(line)]
            rules = []
            for line_no, evidence in enumerate(evidence_lines, start=1):
                hints = semantic_hints(evidence, section.get("title", ""))
                codes = [m["course_code"] for m in section.get("course_mentions", []) if compact(m["evidence"]) == evidence]
                if codes or any(v for k, v in hints.items() if k not in {"operator_hint", "footnotes", "choose_count_hint"}):
                    confidence = "review" if hints["operator_hint"] in {"listed_unspecified", "text_constraint"} else "heuristic"
                    rules.append({
                        "rule_id": f"{pid}:S{section['number']}:L{line_no}",
                        "evidence": evidence,
                        "course_codes": codes,
                        "interpretation": hints,
                        "confidence": confidence,
                    })
                    rule_counts[hints["operator_hint"]] += 1
                    if hints["footnotes"] or hints["has_level_based_pool"] or hints["has_exclusion_or_no_double_count"]:
                        complex_rules.append({
                            "status": "structured_evidence_preserved", "programme_id": pid,
                            "section_number": section["number"], "evidence": evidence,
                            "interpretation": hints,
                            "usage_policy": "Evaluate with the linked evidence; do not flatten this constraint into a plain course list."
                        })
            sections.append({
                "number": section["number"], "title": section["title"],
                "units_as_printed": section.get("units_as_printed"),
                "rules": rules, "raw_text": section.get("raw_text", "")
            })

        seen_mentions = set()
        for mention in programme.get("all_course_mentions", []):
            key = (mention["course_code"], compact(mention["evidence"]))
            if key in seen_mentions:
                continue
            seen_mentions.add(key)
            extraction_status, confidence, catalog_status = validation_for(
                mention["course_code"], mention["prefix_inferred"], catalog, subjects, direct_codes
            )
            validation_counts[catalog_status] += 1
            row = {
                "programme_id": pid,
                "academic_program": programme["academic_program"],
                "faculty": programme.get("faculty"),
                "course_code": mention["course_code"],
                "prefix_inferred": mention["prefix_inferred"],
                "extraction_validation": extraction_status,
                "current_catalog_status": catalog_status,
                "validation_confidence": confidence,
                "evidence": compact(mention["evidence"]),
            }
            mention_rows.append(row)

        clean_programmes.append({
            "programme_id": pid,
            "academic_program": programme["academic_program"],
            "faculty": programme.get("faculty"),
            "academic_year": programme.get("academic_year"),
            "admission_cohort": programme.get("admission_cohort"),
            "minimum_units_as_printed": programme.get("requirement_summary", {}).get("minimum_units_as_printed"),
            "source_sha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
            "source_status": "empty" if not raw.strip() else ("reused_duplicate" if source.get("reused_duplicate_entry") else "captured"),
            "source": source,
            "sections": sections,
        })

    review_unique = []
    review_groups: dict[tuple, dict] = {}
    for item in review:
        key = (item.get("type"), item.get("course_code"), item.get("section_number"), item.get("evidence"))
        if key not in review_groups:
            grouped = dict(item)
            grouped["programme_ids"] = [grouped.pop("programme_id")]
            review_groups[key] = grouped
            review_unique.append(grouped)
        else:
            pid = item.get("programme_id")
            if pid not in review_groups[key]["programme_ids"]:
                review_groups[key]["programme_ids"].append(pid)

    generated = datetime.now(timezone.utc).isoformat()
    result = {
        "schema_version": "2.0-audit",
        "generated_at": generated,
        "interpretation_policy": "Only direct facts are authoritative; semantic operators marked heuristic/review require evidence-aware use.",
        "programme_entry_count": len(clean_programmes),
        "unique_programme_name_count": len({p["academic_program"] for p in clean_programmes}),
        "programmes": clean_programmes,
    }
    (OUT / "programmes-audited.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "review-queue.json").write_text(json.dumps({"generated_at": generated, "items": review_unique}, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUT / "complex-rules.json").write_text(json.dumps({
        "generated_at": generated,
        "status": "organized_evidence_layer_complete",
        "items": complex_rules,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = list(mention_rows[0])
    with (OUT / "course-mentions-audited.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(mention_rows)

    report = {
        "generated_at": generated,
        "programme_entries": len(clean_programmes),
        "unique_programme_names": len({p["academic_program"] for p in clean_programmes}),
        "empty_sources": sum(p["source_status"] == "empty" for p in clean_programmes),
        "reused_duplicate_entries": sum(p["source_status"] == "reused_duplicate" for p in clean_programmes),
        "missing_admission_cohort": sum(not p["admission_cohort"] for p in clean_programmes),
        "missing_minimum_units": sum(not p["minimum_units_as_printed"] for p in clean_programmes),
        "deduplicated_course_mentions": len(mention_rows),
        "direct_course_mentions": sum(not row["prefix_inferred"] for row in mention_rows),
        "prefix_inferred_course_mentions": sum(row["prefix_inferred"] for row in mention_rows),
        "unique_course_codes": len({row["course_code"] for row in mention_rows}),
        "unique_direct_course_codes": len({row["course_code"] for row in mention_rows if not row["prefix_inferred"]}),
        "unique_prefix_inferred_course_codes": len({row["course_code"] for row in mention_rows if row["prefix_inferred"]}),
        "unique_course_codes_by_current_catalog_status": {
            status: len({row["course_code"] for row in mention_rows if row["current_catalog_status"] == status})
            for status in sorted(validation_counts)
        },
        "validation_status_counts": dict(validation_counts),
        "rule_operator_counts": dict(rule_counts),
        "structured_complex_rules": len(complex_rules),
        "unique_course_code_aliases": len(alias_pairs),
        "review_queue_items": len(review_unique),
        "review_queue_by_type": dict(Counter(x["type"] for x in review_unique)),
        "limitations": [
            f"The course index uses snapshot {COURSE_INDEX_LABEL}; absence does not prove an older course code is invalid.",
            "Natural-language graduation rules remain evidence-linked and conservative.",
            "Reused duplicate entries are provenance-marked and must not be treated as independent source captures."
        ]
    }
    (OUT / "audit-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md = [
        "# CUHK 2024 Undergraduate Programme Data Audit", "",
        f"Generated: {generated}", "",
        f"- Programme entries: {report['programme_entries']}",
        f"- Unique programme names: {report['unique_programme_names']}",
        f"- Empty sources: {report['empty_sources']}",
        f"- Reused duplicate entries: {report['reused_duplicate_entries']}",
        f"- Deduplicated course mentions: {report['deduplicated_course_mentions']}",
        f"- Review queue items: {report['review_queue_items']}", "",
        "## Validation statuses", "",
    ] + [f"- {k}: {v}" for k, v in sorted(validation_counts.items())] + ["", "## Review queue"] + [f"- {k}: {v}" for k, v in sorted(Counter(x['type'] for x in review_unique).items())]
    (OUT / "AUDIT.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
