const assert = require("node:assert/strict");
const { EXPECTED_HEADERS, parseRows } = require("./parser.js");

const blank = () => EXPECTED_HEADERS.map(() => "");

const header = [...EXPECTED_HEADERS];
const lecture = [
  "DOTE1030B", "8525", "Economics", "3.00", "Professor", "66", "66",
  "LEC", "B", "E", "Th 09:30AM - 12:15PM", "YIA_LT5", "9/10, 9/17",
  "", "", "Department"
];
const lectureSecondDates = blank();
lectureSecondDates[10] = "Th 09:30AM - 12:15PM";
lectureSecondDates[11] = "YIA_LT5";
lectureSecondDates[12] = "10/8, 10/15";

const tutorial = blank();
tutorial[5] = "20";
tutorial[6] = "4";
tutorial[7] = "TUT";
tutorial[8] = "BT01";
tutorial[9] = "E";
tutorial[10] = "Fr 09:30AM - 10:15AM";
tutorial[11] = "LSK_203";
tutorial[12] = "9/11, 9/18";
tutorial[13] = "Yes";
tutorial[14] = "Yes";
tutorial[15] = "Department";

const tutorialSecondDates = blank();
tutorialSecondDates[10] = "Fr 09:30AM - 10:15AM";
tutorialSecondDates[11] = "LSK_203";
tutorialSecondDates[12] = "10/9, 10/16";

const records = parseRows([
  ["First 1-4 of 4 Last"],
  header,
  lecture,
  lectureSecondDates,
  tutorial,
  tutorialSecondDates
], { academicTerm: "2026-27 Term 1", queriedSubject: "DOTE" });

assert.equal(records.length, 4);
assert.equal(records[1]["Class Code"], "DOTE1030B");
assert.equal(records[1]["Course Component"], "LEC");
assert.equal(records[2]["Course Component"], "TUT");
assert.equal(records[2]["Section Code"], "BT01");
assert.equal(records[3]["Course Component"], "TUT");
assert.equal(records[3]["Meeting Date"], "10/9, 10/16");
assert.equal(records[3]["Class Nbr"], "8525");

console.log("parser tests passed");

