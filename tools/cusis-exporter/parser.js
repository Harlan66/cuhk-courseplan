(function exposeParser(root, factory) {
  const api = factory();
  root.CUHKTimetableParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis, () => {
  "use strict";

  const EXPECTED_HEADERS = [
    "Class Code", "Class Nbr", "Course Title", "Units", "Teaching Staff",
    "Quota(s)", "Vacancy", "Course Component", "Section Code", "Language",
    "Period", "Room", "Meeting Date", "Add Consent", "Drop Consent",
    "Course Offering Dept"
  ];

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function parseRows(rawRows, { academicTerm, queriedSubject }) {
    const rows = rawRows.map((cells) => cells.map(clean));
    const headerIndex = rows.findIndex((cells) =>
      cells.includes("Class Code") && cells.includes("Class Nbr")
    );
    if (headerIndex < 0) throw new Error("CUSIS result headers were not recognized");

    const headers = rows[headerIndex];
    const positions = EXPECTED_HEADERS.map((header) => headers.indexOf(header));
    if (positions.some((index) => index < 0)) {
      throw new Error("CUSIS result columns have changed");
    }

    const output = [];
    let classBase = null;
    let meetingBase = null;

    for (const cells of rows.slice(headerIndex + 1)) {
      const values = positions.map((position) => cells[position] || "");
      const row = Object.fromEntries(EXPECTED_HEADERS.map((header, index) =>
        [header, values[index]]
      ));

      if (row["Class Code"]) {
        classBase = { ...row };
        meetingBase = { ...row };
      } else if (classBase && (row.Period || row.Room || row["Meeting Date"])) {
        const startsNewComponent = Boolean(
          row["Course Component"] || row["Section Code"] ||
          row["Quota(s)"] || row.Vacancy
        );
        for (const header of EXPECTED_HEADERS) {
          if (!row[header]) row[header] = meetingBase?.[header] || classBase[header] || "";
        }
        if (startsNewComponent) meetingBase = { ...row };
      } else {
        continue;
      }

      output.push({
        "Academic Term": academicTerm,
        "Queried Subject": queriedSubject,
        ...row
      });
    }

    return output;
  }

  return { EXPECTED_HEADERS, clean, parseRows };
});

