import fs from "node:fs/promises";
import path from "node:path";

const [oldFull, newFull, outputDirectory = path.dirname(newFull)] = process.argv.slice(2);
if (!oldFull || !newFull) {
  console.error("Usage: node tools/compare-cusis-snapshots.mjs <old-full.json> <new-full.json> [output-dir]");
  process.exit(1);
}

const [oldPayload, newPayload] = await Promise.all([
  fs.readFile(oldFull, "utf8").then(JSON.parse),
  fs.readFile(newFull, "utf8").then(JSON.parse)
]);

const fields = [
  "Class Code", "Class Nbr", "Course Title", "Units", "Teaching Staff",
  "Quota(s)", "Vacancy", "Course Component", "Section Code", "Language",
  "Period", "Room", "Meeting Date", "Add Consent", "Drop Consent",
  "Course Offering Dept"
];
const keyOf = (row) => [row["Class Nbr"], row["Course Component"], row["Section Code"]].join("|");
const oldMap = new Map((oldPayload.classes || []).map((row) => [keyOf(row), row]));
const newMap = new Map((newPayload.classes || []).map((row) => [keyOf(row), row]));
const added = [];
const removed = [];
const changed = [];
const changedByField = Object.fromEntries(fields.map((field) => [field, 0]));
const vacancyOnly = [];

for (const [key, row] of newMap) {
  if (!oldMap.has(key)) {
    added.push(row);
    continue;
  }
  const oldRow = oldMap.get(key);
  const diffs = fields.filter((field) => String(oldRow[field] ?? "") !== String(row[field] ?? ""));
  if (diffs.length) {
    for (const field of diffs) changedByField[field] += 1;
    const item = {
      key,
      course: row["Class Code"],
      classNbr: row["Class Nbr"],
      fields: diffs,
      old: Object.fromEntries(diffs.map((field) => [field, oldRow[field] ?? ""])),
      new: Object.fromEntries(diffs.map((field) => [field, row[field] ?? ""]))
    };
    changed.push(item);
    if (diffs.length === 1 && diffs[0] === "Vacancy") vacancyOnly.push(item);
  }
}
for (const [key, row] of oldMap) {
  if (!newMap.has(key)) removed.push(row);
}

const oldSubjectsWithClasses = new Set((oldPayload.classes || []).map((row) => row["Queried Subject"]).filter(Boolean));
const newSubjectsWithClasses = new Set((newPayload.classes || []).map((row) => row["Queried Subject"]).filter(Boolean));
const subjectAdded = [...newSubjectsWithClasses].filter((subject) => !oldSubjectsWithClasses.has(subject)).sort();
const subjectRemoved = [...oldSubjectsWithClasses].filter((subject) => !newSubjectsWithClasses.has(subject)).sort();
const result = {
  generatedAt: new Date().toISOString(),
  old: { file: oldFull, metadata: oldPayload.metadata },
  new: { file: newFull, metadata: newPayload.metadata },
  counts: {
    oldClasses: oldMap.size,
    newClasses: newMap.size,
    addedClasses: added.length,
    removedClasses: removed.length,
    changedClasses: changed.length,
    vacancyOnlyClasses: vacancyOnly.length,
    oldMeetingRows: oldPayload.meetings?.length || 0,
    newMeetingRows: newPayload.meetings?.length || 0
  },
  changedByField,
  subjectAdded,
  subjectRemoved,
  added,
  removed,
  changed,
  vacancyOnly
};

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(path.join(outputDirectory, "term-1-diff.json"), `${JSON.stringify(result, null, 2)}\n`);
const md = [
  "# Term 1 CUSIS 快照对账",
  "",
  `生成时间：${result.generatedAt}`,
  "",
  "## 总结",
  "",
  `- 旧快照班别组件：${oldMap.size}`,
  `- 新快照班别组件：${newMap.size}`,
  `- 新增班别组件：${added.length}`,
  `- 消失班别组件：${removed.length}`,
  `- 有字段变化的既有班别：${changed.length}`,
  `- 仅 Vacancy 变化：${vacancyOnly.length}`,
  `- 旧/新 meeting 行：${oldPayload.meetings?.length || 0} / ${newPayload.meetings?.length || 0}`,
  "",
  "## 字段变化计数",
  "",
  "| 字段 | 变化班别数 |",
  "|---|---:|",
  ...fields.map((field) => `| ${field} | ${changedByField[field]} |`),
  "",
  "## 科目覆盖变化",
  "",
  `- 新增出现排课的科目：${subjectAdded.length ? subjectAdded.join(", ") : "无"}`,
  `- 不再出现排课的科目：${subjectRemoved.length ? subjectRemoved.join(", ") : "无"}`,
  "",
  "完整逐班差异见同目录 `term-1-diff.json`；原始数据仍保留在快照 `raw/2420/`。",
  ""
].join("\n");
await fs.writeFile(path.join(outputDirectory, "term-1-diff.md"), md);
console.log(JSON.stringify(result.counts, null, 2));
