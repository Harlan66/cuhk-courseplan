import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const requirements = read("data/curriculum/requirements.json");
const rules = read("data/curriculum/eligibility-rules.json");
const prerequisites = read("data/curriculum/course-prerequisites.json");

const ruleIds = new Set([
  ...rules.requirementRules,
  ...rules.exclusionAndSubstitutionRules,
  ...rules.doubleCountingRules,
].map((rule) => rule.id));

const errors = [];
for (const requirement of requirements.requirements) {
  for (const ref of requirement.ruleRefs || []) {
    if (!ruleIds.has(ref)) errors.push(`Unknown ruleRef ${ref} on ${requirement.id}`);
  }
  if (requirement.choice && requirement.choice.courses?.length !== requirement.choice.of) {
    errors.push(`Choice count mismatch on ${requirement.id}`);
  }
}

const banCourses = new Set(
  rules.requirementRules
    .filter((rule) => rule.id.startsWith("BAN_") && Array.isArray(rule.courses))
    .flatMap((rule) => rule.courses)
);
for (const course of banCourses) {
  if (!prerequisites.courses[course]) errors.push(`Missing prerequisite record for ${course}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const courseRules = Object.values(prerequisites.courses);
console.log(JSON.stringify({
  requirements: requirements.requirements.length,
  rules: ruleIds.size,
  prerequisiteRecords: courseRules.length,
  verifiedPrerequisiteRecords: courseRules.filter((rule) => rule.verified).length,
  unresolvedPrerequisiteRecords: courseRules.filter((rule) => !rule.verified).length,
  status: "OK"
}, null, 2));
