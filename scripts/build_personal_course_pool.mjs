import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const profileData = JSON.parse(await readFile(resolve(root, "data/student/profile.json"), "utf8"));
const term = profileData.student?.targetTerm;
if (!term) throw new Error("Student profile is not initialized: targetTerm is required.");

const curatedRoot = resolve(root, "data/cuhk-timetable/curated");
const termNumber = term.match(/Term\s+(\d+)/i)?.[1];
const requestedDirectory = process.argv[2];
const availableDirectories = requestedDirectory ? [] : await readdir(curatedRoot, { withFileTypes: true });
const matchingDirectory = requestedDirectory ?? availableDirectories
  .filter((entry) => entry.isDirectory() && termNumber && entry.name.endsWith(`-term-${termNumber}`))
  .map((entry) => entry.name)
  .sort()
  .at(-1);
if (!matchingDirectory) throw new Error(`No curated timetable snapshot found for ${term}. Pass its directory as the first argument.`);
const curated = resolve(curatedRoot, matchingDirectory);

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift().map((value) => value.replace(/^\uFEFF/, ""));
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

const [classRows, requirementData, historyData, prerequisiteData] = await Promise.all([
  readFile(resolve(curated, "classes.csv"), "utf8").then(parseCsv),
  readFile(resolve(root, "data/curriculum/requirements.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "data/student/course-history.json"), "utf8").then(JSON.parse),
  readFile(resolve(root, "data/curriculum/course-prerequisites.json"), "utf8").then(JSON.parse),
]);

const completed = new Set(historyData.completedCourses);
const requirementByCourse = new Map();
for (const requirement of requirementData.requirements.filter((item) => !item.completed)) {
  const codes = requirement.choice?.courses ?? (requirement.id.match(/^[A-Z]{2,6}\d{4}$/) ? [requirement.id] : []);
  for (const code of codes) requirementByCourse.set(code, {
    label: requirement.label,
    kind: requirement.choice ? "choice" : "required",
    group: requirement.group,
  });
}

function prerequisiteResult(expression) {
  if (!expression || expression === "unknown") return { met: expression === null, permission: false, missing: [] };
  if (expression.course) return { met: completed.has(expression.course), permission: false, missing: completed.has(expression.course) ? [] : [expression.course] };
  if (expression.permissionFromInstructor) return { met: false, permission: true, missing: [] };
  if (expression.allOf) {
    const parts = expression.allOf.map(prerequisiteResult);
    return { met: parts.every((part) => part.met), permission: parts.some((part) => part.permission), missing: [...new Set(parts.flatMap((part) => part.missing))] };
  }
  if (expression.anyOf) {
    const parts = expression.anyOf.map(prerequisiteResult);
    if (parts.some((part) => part.met)) return { met: true, permission: false, missing: [] };
    return { met: false, permission: parts.some((part) => part.permission), missing: [...new Set(parts.flatMap((part) => part.missing))] };
  }
  return { met: false, permission: false, missing: [] };
}

const aggregated = new Map();
for (const row of classRows) {
  const current = aggregated.get(row.course_code) ?? {
    code: row.course_code,
    subject: row.course_code.match(/^[A-Z]+/)?.[0] ?? "",
    titleEn: row.course_title_en,
    titleZh: row.course_title_zh,
    units: Number(row.units || 0),
    classes: 0,
    vacancy: 0,
    consentClasses: 0,
  };
  current.classes += 1;
  current.vacancy += Number(row.vacancy || 0);
  if (row.add_consent) current.consentClasses += 1;
  aggregated.set(row.course_code, current);
}

const programmeSubjects = new Set(requirementData.requirements.flatMap((requirement) => {
  const codes = requirement.choice?.courses ?? [requirement.id];
  return codes.map((code) => code.match(/^[A-Z]+/)?.[0]).filter(Boolean);
}));
const courses = [...aggregated.values()].map((course) => {
  const requirementInfo = requirementByCourse.get(course.code) ?? null;
  const requirement = requirementInfo?.label ?? null;
  const rule = prerequisiteData.courses[course.code];
  const prereq = prerequisiteResult(rule?.prerequisite);
  let bucket = "available";
  let category = requirement ? "requirement" : programmeSubjects.has(course.subject) ? "programme" : /^(UGE|GE[A-Z]{2})/.test(course.subject) ? "general_education" : "elective";
  const reasons = [];

  if (completed.has(course.code)) {
    bucket = "unavailable";
    category = "completed";
    reasons.push("已修读完成，不再列入本学期候选课程");
  } else if (course.vacancy === 0) {
    bucket = "unavailable";
    reasons.push("当前所有班别均无余位");
  } else if (rule?.prerequisite && rule.prerequisite !== "unknown" && !prereq.met && !prereq.permission) {
    bucket = "unavailable";
    reasons.push(`尚未满足先修课程：${prereq.missing.join("、")}`);
  } else if (course.consentClasses === course.classes && course.classes > 0) {
    bucket = "review";
    reasons.push("所有班别均要求教师或开课院系批准");
  } else if (prereq.permission && !prereq.met) {
    bucket = "review";
    reasons.push("先修条件未自动满足，但可尝试向任课教师申请批准");
  } else if (rule?.status === "unknown_not_in_source" || rule?.prerequisite === "unknown") {
    bucket = "review";
    reasons.push("当前资料未包含完整先修及选课限制，需要在CUSIS或向院系确认");
  } else {
    if (requirement) reasons.push(`可用于：${requirement}`);
    else if (category === "programme") reasons.push("本学期开设的商学院课程；能否计入专业要求需按培养方案确认");
    else if (category === "general_education") reasons.push("本学期开设的通识或书院课程");
    else reasons.push("本学期开设，可作为其他选修考虑；仍须遵守CUSIS实时限制");
    if (course.consentClasses > 0) reasons.push(`其中${course.consentClasses}个班别需要批准`);
  }

  const graduationPriority = requirementInfo?.kind === "required" ? 100
    : requirementInfo?.kind === "choice" ? 90
      : category === "general_education" ? 70
        : category === "programme" ? 50 : 20;
  return { ...course, requirement, bucket, category, graduationPriority, reasons };
}).sort((a, b) => {
  const bucketOrder = { available: 0, review: 1, unavailable: 2 };
  const categoryOrder = { requirement: 0, programme: 1, general_education: 2, elective: 3, completed: 4 };
  return bucketOrder[a.bucket] - bucketOrder[b.bucket]
    || b.graduationPriority - a.graduationPriority
    || categoryOrder[a.category] - categoryOrder[b.category]
    || b.vacancy - a.vacancy
    || a.code.localeCompare(b.code);
});

const counts = courses.reduce((result, course) => {
  result[course.bucket] = (result[course.bucket] ?? 0) + 1;
  return result;
}, {});

await writeFile(resolve(root, "app/generated-course-pool.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  term,
  curatedSnapshot: matchingDirectory,
  sourceCourses: aggregated.size,
  counts,
  courses,
}, null, 2));

console.log(JSON.stringify({ sourceCourses: aggregated.size, counts }));
