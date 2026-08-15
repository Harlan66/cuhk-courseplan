import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const currentId = "2026-08-15T01-53-13+08-00-full-term-1";
const priorId = "2026-08-15T00-47-47+08-00";
const detailId = "2026-08-15T01-38-53+08-00";
const recaptureId = "2026-08-15T18-34-00+08-00-gap-recapture";
const snapshots = path.join(root, "data/cuhk-timetable/snapshots");
const legacySnapshots = path.join(root, "archive/legacy-snapshots");
const output = path.join(root, "data/cuhk-timetable/curated/2026-08-15-term-1");
const termCode = "2420";
const termLabel = "2026-27 Term 1";
const schoolApprovalRequired = new Set(["ARTS", "ELTU", "GPSU", "NURS", "SSMU"]);
const recapturedSubjects = new Set(["CHLT", "ENGG", "GECC"]);
const recheckDisplayed = new Set([
  "CHLT", "CSCI", "CURE", "DOTE", "ELEG", "ENGE", "ENGG", "ESTR",
  "GECC", "IERG", "JASP", "MATH", "PHED"
]);

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const integer = (value) => /^-?\d+$/.test(clean(value)) ? Number(clean(value)) : null;
const decimal = (value) => /^-?\d+(?:\.\d+)?$/.test(clean(value)) ? Number(clean(value)) : null;
const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (rows, headers) => "\uFEFF" + [headers, ...rows.map((row) =>
  headers.map((header) => row[header] ?? "")
)].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
const splitTitle = (value) => {
  const text = clean(value);
  const index = text.search(/[\u3400-\u9fff]/);
  return index < 0
    ? { course_title_en: text, course_title_zh: "" }
    : { course_title_en: text.slice(0, index).trim(), course_title_zh: text.slice(index).trim() };
};
const courseCodeOf = (classCode) => clean(classCode).match(/^([A-Z]+\d{4})/)?.[1] || "";
const key = (...parts) => parts.map(clean).join("|");
const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

await fs.mkdir(output, { recursive: true });
const subjectMetadata = await readJson(path.join(snapshots, currentId, "metadata/subjects.json"));
const selectedRecords = [];
const subjects = [];
const captureStatus = [];

for (const subjectCode of subjectMetadata.subjects) {
  const currentPath = path.join(snapshots, currentId, "raw", termCode, `${subjectCode}.json`);
  const priorPath = path.join(legacySnapshots, priorId, "raw", termCode, `${subjectCode}.json`);
  const recapturePath = path.join(snapshots, recaptureId, "raw", termCode, `${subjectCode}.json`);
  const current = await readJson(currentPath);
  let selected = current;
  let selectedPath = currentPath;
  let sourceSnapshotId = currentId;
  let sourceKind = "current";
  let queryStatus = current.status;
  let reviewNote = "";
  if (recapturedSubjects.has(subjectCode)) {
    const recaptured = await readJson(recapturePath);
    selected = recaptured;
    selectedPath = recapturePath;
    sourceSnapshotId = recaptureId;
    sourceKind = "gap_recapture";
    queryStatus = "data";
    reviewNote = "Complete result grid recaptured from the official public timetable.";
  } else if (!(current.ok && current.status === "data")) {
    const prior = await readJson(priorPath);
    if (prior.ok && prior.status === "data") {
      selected = prior;
      selectedPath = priorPath;
      sourceSnapshotId = priorId;
      sourceKind = "historical_fallback";
      queryStatus = "historical_fallback";
      reviewNote = "Latest query was invalid/blank; records use the previous snapshot and may be stale.";
    } else if (schoolApprovalRequired.has(subjectCode)) {
      queryStatus = "school_approval_required";
      reviewNote = "Per confirmed project rule, this subject requires school approval; absence of public rows is not treated as a collection gap.";
    } else if (recheckDisplayed.has(subjectCode)) {
      queryStatus = "recheck_displayed_raw_missing";
      reviewNote = "Recheck displayed a result grid, but the complete table was not persisted; no rows are fabricated.";
    } else {
      queryStatus = current.status || "failed";
      reviewNote = current.error || "Unresolved capture status.";
    }
  }
  const records = selected.status === "data" ? selected.records : [];
  selectedRecords.push(...records.map((record) => ({ ...record, _source_snapshot_id: sourceSnapshotId, _source_kind: sourceKind })));
  const uniqueClassCount = new Set(records.map((row) => clean(row["Class Nbr"])).filter(Boolean)).size;
  subjects.push({
    term_code: termCode, subject_code: subjectCode, subject_name: "",
    query_status: queryStatus, query_error: queryStatus === "data" ? "" : (current.error || ""),
    main_record_count: records.length, unique_class_nbr_count: uniqueClassCount,
    first_captured_at: current.startedAt || "", last_checked_at: current.completedAt || "",
    source_snapshot_id: sourceSnapshotId, source_kind: sourceKind, review_note: reviewNote
  });
  captureStatus.push({
    entity_type: "subject", entity_id: subjectCode, term_code: termCode,
    course_code: "", class_nbr: "", status: queryStatus, reason: reviewNote || current.error || "",
    attempt_count: current.attempts?.length || 0, first_attempt_at: current.startedAt || "",
    last_attempt_at: current.completedAt || "", source_snapshot_id: sourceSnapshotId,
    raw_path: path.relative(root, selectedPath)
  });
}

const meetingMap = new Map();
for (const row of selectedRecords) {
  const classNbr = clean(row["Class Nbr"]);
  const classCode = clean(row["Class Code"]);
  if (!classNbr || !classCode) continue;
  const meetingKey = key(
    termCode, classNbr, row["Course Component"], row["Section Code"], row.Period,
    row.Room, row["Meeting Date"], row["Teaching Staff"]
  );
  if (!meetingMap.has(meetingKey)) meetingMap.set(meetingKey, row);
}
const meetingSeq = new Map();
const meetings = [...meetingMap.values()].map((row) => {
  const classNbr = clean(row["Class Nbr"]);
  const seq = (meetingSeq.get(classNbr) || 0) + 1;
  meetingSeq.set(classNbr, seq);
  const period = clean(row.Period);
  const match = period.match(/^([A-Za-z#&]+)\s+(\d{1,2}:\d{2}(?:AM|PM))\s+-\s+(\d{1,2}:\d{2}(?:AM|PM))$/i);
  return {
    term_code: termCode, class_nbr: classNbr, meeting_seq: seq,
    component: clean(row["Course Component"]), section_code: clean(row["Section Code"]),
    days: match?.[1] || (period === "TBA" ? "TBA" : ""),
    start_time: match?.[2] || "", end_time: match?.[3] || "",
    period_raw: period, room_code: clean(row.Room), room_name: "",
    meeting_dates_raw: clean(row["Meeting Date"]), instructor: clean(row["Teaching Staff"]),
    source_snapshot_id: row._source_snapshot_id, captured_at: ""
  };
});

const classMap = new Map();
for (const row of selectedRecords) {
  const classNbr = clean(row["Class Nbr"]);
  if (!classNbr) continue;
  const existing = classMap.get(classNbr);
  if (!existing || clean(row["Class Code"])) classMap.set(classNbr, row);
}
const classes = [...classMap.values()].map((row) => {
  const title = splitTitle(row["Course Title"]);
  return {
    term_code: termCode, class_nbr: clean(row["Class Nbr"]),
    course_code: courseCodeOf(row["Class Code"]), class_code: clean(row["Class Code"]),
    section_code: clean(row["Section Code"]), primary_component: clean(row["Course Component"]),
    career: "Undergraduate", language: clean(row.Language), units: decimal(row.Units),
    ...title, teaching_staff: clean(row["Teaching Staff"]),
    quota_total: integer(row["Quota(s)"]), vacancy: integer(row.Vacancy),
    add_consent: clean(row["Add Consent"]), drop_consent: clean(row["Drop Consent"]),
    course_offering_dept: clean(row["Course Offering Dept"]),
    source_snapshot_id: row._source_snapshot_id, source_kind: row._source_kind, captured_at: ""
  };
});

const courseMap = new Map();
for (const row of classes) {
  if (!row.course_code) continue;
  if (!courseMap.has(row.course_code)) courseMap.set(row.course_code, {
    course_code: row.course_code, subject_code: row.course_code.match(/^[A-Z]+/)?.[0] || "",
    course_number: row.course_code.match(/\d{4}$/)?.[0] || "",
    course_title_en: row.course_title_en, course_title_zh: row.course_title_zh,
    units: row.units, catalog_status: "not_collected", source_snapshot_id: row.source_snapshot_id
  });
}

const detailRoot = path.join(snapshots, detailId, "raw", termCode);
const listJson = async (directory) => {
  try { return (await fs.readdir(directory)).filter((name) => name.endsWith(".json")); }
  catch { return []; }
};
const lines = (text) => String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
const valueAfter = (text, label) => {
  const items = lines(text); const index = items.indexOf(label);
  return index >= 0 ? items[index + 1] || "" : "";
};
const classDetails = [];
for (const name of await listJson(path.join(detailRoot, "class-details"))) {
  const item = await readJson(path.join(detailRoot, "class-details", name));
  classDetails.push({
    term_code: termCode, class_nbr: item.classNbr, course_code: item.course,
    class_code: item.classCode, class_status: valueAfter(item.text, "Status"),
    session: valueAfter(item.text, "Session"), units: decimal(valueAfter(item.text, "Units")),
    instruction_mode: valueAfter(item.text, "Instruction Mode"),
    course_id: valueAfter(item.text, "Course ID"), offer_number: valueAfter(item.text, "Offer Nbr"),
    career: valueAfter(item.text, "Career"), dates_raw: valueAfter(item.text, "Dates"),
    grading_basis: valueAfter(item.text, "Grading"), campus: valueAfter(item.text, "Campus"),
    class_capacity: integer(valueAfter(item.text, "Class Capacity")),
    waitlist_capacity: integer(valueAfter(item.text, "Wait List Capacity")),
    enrollment_total: integer(valueAfter(item.text, "Enrollment Total")),
    waitlist_total: integer(valueAfter(item.text, "Wait List Total")),
    available_seats: integer(valueAfter(item.text, "Available Seats")),
    raw_text: item.text, source_snapshot_id: detailId, captured_at: item.capturedAt,
    parse_status: "common_fields_parsed_raw_preserved"
  });
}

const reservedQuotas = [];
for (const name of await listJson(path.join(detailRoot, "reserved-quota"))) {
  const item = await readJson(path.join(detailRoot, "reserved-quota", name));
  const itemLines = lines(item.text);
  const header = itemLines.indexOf("Reserved for Enrolment Quota Enrolment Total");
  const tail = itemLines.indexOf("Return");
  const values = header >= 0 ? itemLines.slice(header + 1, tail < 0 ? undefined : tail) : [];
  for (let index = 0, seq = 1; index + 2 < values.length; index += 3, seq += 1) {
    reservedQuotas.push({
      term_code: termCode, class_nbr: item.classNbr, quota_seq: seq,
      reserved_for: values[index], enrollment_quota: integer(values[index + 1]),
      enrollment_total: integer(values[index + 2]), source_snapshot_id: detailId,
      captured_at: item.capturedAt
    });
  }
}

const courseCatalog = [];
for (const name of await listJson(path.join(detailRoot, "course-catalog"))) {
  const item = await readJson(path.join(detailRoot, "course-catalog", name));
  courseCatalog.push({
    course_code: item.course, career: valueAfter(item.text, "Course Detail"),
    units: decimal(valueAfter(item.text, "Units")), grading_basis: valueAfter(item.text, "Grading Basis"),
    campus: valueAfter(item.text, "Campus"), academic_group: valueAfter(item.text, "Academic Group"),
    academic_organization: valueAfter(item.text, "Academic Organization"),
    add_consent: valueAfter(item.text, "Add Consent"), drop_consent: valueAfter(item.text, "Drop Consent"),
    enrollment_requirement: valueAfter(item.text, "Enrollment Requirement"),
    description: valueAfter(item.text, "Description"), raw_text: item.text,
    source_snapshot_id: detailId, captured_at: item.capturedAt,
    parse_status: "common_fields_parsed_raw_preserved"
  });
  if (courseMap.has(item.course)) courseMap.get(item.course).catalog_status = "captured";
}
const courses = [...courseMap.values()];
const detailByClass = new Set(classDetails.map((row) => row.class_nbr));
const quotaByClass = new Set(reservedQuotas.map((row) => row.class_nbr));
const catalogByCourse = new Set(courseCatalog.map((row) => row.course_code));
const courseCompleteness = courses.map((course) => {
  const courseClasses = classes.filter((row) => row.course_code === course.course_code);
  const capturedDetails = courseClasses.filter((row) => detailByClass.has(row.class_nbr)).length;
  return {
    course_code: course.course_code, subject_code: course.subject_code,
    class_count: courseClasses.length, class_details_captured: capturedDetails,
    class_details_missing: courseClasses.length - capturedDetails,
    quota_rows_captured: courseClasses.filter((row) => quotaByClass.has(row.class_nbr)).length,
    catalog_status: catalogByCourse.has(course.course_code) ? "captured" : "not_collected",
    overall_status: capturedDetails === courseClasses.length && catalogByCourse.has(course.course_code)
      ? "complete" : "partial"
  };
});

const datasets = {
  subjects, courses, classes, meetings, class_details: classDetails,
  reserved_quotas: reservedQuotas, course_catalog: courseCatalog,
  capture_status: captureStatus, course_completeness: courseCompleteness
};
for (const [name, rows] of Object.entries(datasets)) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  await fs.writeFile(path.join(output, `${name}.csv`), csv(rows, headers), "utf8");
}

const duplicateClassNumbers = classes.length - new Set(classes.map((row) => row.class_nbr)).size;
const duplicateMeetingKeys = meetings.length - new Set(meetings.map((row) => key(row.class_nbr, row.meeting_seq))).size;
const orphanMeetings = meetings.filter((row) => !classMap.has(row.class_nbr)).length;
const orphanClasses = classes.filter((row) => !courseMap.has(row.course_code)).length;
const report = {
  generated_at: new Date().toISOString(), term_code: termCode, term_label: termLabel,
  source_policy: "Latest verified subject data; historical fallback is explicitly labeled; no rows fabricated from recheck snippets.",
  counts: Object.fromEntries(Object.entries(datasets).map(([name, rows]) => [name, rows.length])),
  subject_status_counts: Object.fromEntries([...new Set(subjects.map((row) => row.query_status))].map((status) =>
    [status, subjects.filter((row) => row.query_status === status).length]
  )),
  validation: { duplicate_class_numbers: duplicateClassNumbers, duplicate_meeting_keys: duplicateMeetingKeys, orphan_meetings: orphanMeetings, orphan_classes: orphanClasses },
  unresolved_subjects: subjects.filter((row) => !["data", "historical_fallback", "school_approval_required"].includes(row.query_status)).map((row) => ({ subject_code: row.subject_code, query_status: row.query_status, review_note: row.review_note }))
};
await fs.writeFile(path.join(output, "quality_report.json"), JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(path.join(output, "README.md"), `# 2026-27 Term 1 清洗数据\n\n生成时间：${report.generated_at}\n\n- Subject：${subjects.length}\n- Course：${courses.length}\n- Class：${classes.length}\n- Meeting：${meetings.length}\n- Class Detail：${classDetails.length}\n- Reserved Quota rows：${reservedQuotas.length}\n- Course Catalog：${courseCatalog.length}\n\n最新失败项不会被标为无课；历史回填行通过 source_kind 和 source_snapshot_id 显式标记。完整验证结果见 quality_report.json。\n`);
console.log(JSON.stringify(report, null, 2));
