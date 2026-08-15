import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC_URL =
  "https://rgsntl.rgs.cuhk.edu.hk/rws_prd_applx2/Public/tt_dsp_timetable.aspx";
const CUSIS_URL =
  "https://cusis.cuhk.edu.hk/psc/CSPRD_newwin/EMPLOYEE/HRMS/c/CU_SCR_MENU.CU_TMSR801.GBL";

export const HEADERS = [
  "Class Code", "Class Nbr", "Course Title", "Units", "Teaching Staff",
  "Quota(s)", "Vacancy", "Course Component", "Section Code", "Language",
  "Period", "Room", "Meeting Date", "Add Consent", "Drop Consent",
  "Course Offering Dept"
];

export const TERMS = {
  "2420": { label: "2026-27 Term 1", slug: "term-1" },
  "2430": { label: "2026-27 Term 2", slug: "term-2" }
};

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseRows(rawRows, termValue, subject) {
  const rows = rawRows.map((cells) => cells.map(clean));
  const output = [];
  let classBase = null;
  let meetingBase = null;

  for (const cells of rows) {
    const row = Object.fromEntries(HEADERS.map((header, index) =>
      [header, cells[index] || ""]
    ));

    if (row["Class Code"]) {
      classBase = { ...row };
      meetingBase = { ...row };
    } else if (classBase && (row.Period || row.Room || row["Meeting Date"])) {
      const startsNewComponent = Boolean(
        row["Course Component"] || row["Section Code"] ||
        row["Quota(s)"] || row.Vacancy
      );
      for (const header of HEADERS) {
        if (!row[header]) row[header] = meetingBase?.[header] || classBase[header] || "";
      }
      if (startsNewComponent) meetingBase = { ...row };
    } else {
      continue;
    }

    output.push({
      "Academic Term": TERMS[termValue].label,
      "Term Value": termValue,
      "Queried Subject": subject,
      ...row
    });
  }
  return output;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(records, headers) {
  return [
    headers.map(csvCell).join(","),
    ...records.map((record) => headers.map((header) =>
      csvCell(record[header])
    ).join(","))
  ].join("\r\n");
}

export async function fetchSubjects() {
  const response = await fetch(PUBLIC_URL);
  if (!response.ok) throw new Error(`Official subject list HTTP ${response.status}`);
  const html = await response.text();
  const block = html.match(
    /<select[^>]+id=["']ddl_subject["'][^>]*>([\s\S]*?)<\/select>/i
  )?.[1] || "";
  const subjects = [...block.matchAll(
    /<option[^>]+value=["']([A-Z0-9]+)["'][^>]*>/gi
  )].map((match) => match[1]);
  if (subjects.length < 50) throw new Error("Official subject list is incomplete");
  return subjects;
}

async function readGrid(tab, grid, termValue, subject) {
  const cells = await grid.locator("td", {}).allTextContents({ timeoutMs: 15000 });
  const body = cells.slice(1);
  if (body.length % HEADERS.length !== 0) {
    throw new Error(`Unexpected result cell count: ${body.length}`);
  }
  const rows = [];
  for (let index = 0; index < body.length; index += HEADERS.length) {
    rows.push(body.slice(index, index + HEADERS.length));
  }
  return parseRows(rows, termValue, subject);
}

function isAuthenticationPage(url, bodyText) {
  return /sts\.cuhk\.edu\.hk|\/adfs\/ls\//i.test(url || "") ||
    /Change Password\s*\|\s*Forgot Password|CADS Reference Number/i.test(bodyText || "");
}

async function querySubjectOnce(tab, termValue, subject, attempt) {
  const startedAt = new Date().toISOString();
  await tab.goto(CUSIS_URL);
  await tab.playwright.waitForTimeout(350);

  const landingText = await tab.playwright.locator("body").innerText({ timeoutMs: 10000 });
  if (isAuthenticationPage(await tab.url(), landingText)) {
    throw new Error("CUSIS authentication is required");
  }

  // Term 1 is the landing-page default. Do not touch it: selecting that
  // already-selected option makes PeopleSoft rebuild the form asynchronously.
  if (termValue !== "2420") {
    const termSelect = tab.playwright.getByLabel("Term", { exact: true });
    await termSelect.waitFor({ state: "visible", timeoutMs: 15000 });
    await termSelect.selectOption(
      { value: termValue },
      { timeoutMs: 10000 }
    );
    await tab.playwright.waitForTimeout(700);
  }
  const subjectInput = tab.playwright.getByLabel("Course Subject", { exact: true });
  await subjectInput.waitFor({ state: "visible", timeoutMs: 15000 });
  await subjectInput.fill(
    subject,
    { timeoutMs: 10000 }
  );

  const grid = tab.playwright.locator('[id="CLASS_LIST$scroll$0"]');
  const search = tab.playwright.getByRole("link", { name: "Search", exact: true });
  let searchError = null;
  await tab.playwright.waitForTimeout(250);
  if (!(await grid.count())) {
    try {
      await search.waitFor({ state: "visible", timeoutMs: 15000 });
      await search.click({ timeoutMs: 10000 });
    } catch (error) {
      // PeopleSoft frequently replaces the Search link while the click is
      // navigating. Preserve the error, but accept the action if a result
      // grid, an explicit empty message, or a dialog subsequently appears.
      searchError = error;
    }
  }
  await tab.playwright.waitForTimeout(500);

  if (!(await grid.count()) && await search.count()) {
    try {
      await search.click({ timeoutMs: 10000 });
      searchError = null;
    } catch (error) {
      searchError ||= error;
    }
  }

  await tab.playwright.waitForTimeout(300);
  const dialog = await tab.getJsDialog();
  if (dialog) {
    await dialog.dismiss();
    return {
      attempt,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "empty",
      emptyEvidence: "CUSIS JavaScript dialog after search",
      records: []
    };
  }

  const earlyText = await tab.playwright.locator("body").innerText({ timeoutMs: 3000 });
  if (isAuthenticationPage(await tab.url(), earlyText)) {
    throw new Error("CUSIS session expired during search");
  }
  if (/No classes|no matching values|no results?|returned no/i.test(earlyText)) {
    return {
      attempt,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "empty",
      emptyEvidence: "Explicit no-results text",
      records: []
    };
  }

  for (let pollIndex = 0; pollIndex < 4; pollIndex += 1) {
    if (await grid.count()) {
      const records = await readGrid(tab, grid, termValue, subject);
      return {
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "data",
        emptyEvidence: null,
        records
      };
    }
    await tab.playwright.waitForTimeout(250);
  }

  const bodyText = await tab.playwright.locator("body").innerText({ timeoutMs: 3000 });
  if (isAuthenticationPage(await tab.url(), bodyText)) {
    throw new Error("CUSIS session expired during search");
  }
  if (searchError && !/No classes|no matching values|no results?|returned no/i.test(bodyText)) {
    throw searchError;
  }
  return {
    attempt,
    startedAt,
    completedAt: new Date().toISOString(),
    status: "empty",
    emptyEvidence: /No classes|no matching values|no results?|returned no/i.test(bodyText)
      ? "Explicit no-results text"
      : "Blank result area",
    records: []
  };
}

async function querySubject(tab, termValue, subject, maxAttempts = 2) {
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await querySubjectOnce(tab, termValue, subject, attempt);
    attempts.push({
      attempt: result.attempt,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      status: result.status,
      emptyEvidence: result.emptyEvidence,
      recordCount: result.records.length
    });
    if (result.status === "data") {
      return { status: "data", records: result.records, attempts };
    }
  }
  const explicitlyEmpty = attempts.every((item) =>
    item.emptyEvidence === "Explicit no-results text"
  );
  return {
    status: explicitlyEmpty ? "confirmed_empty" : "needs_review",
    records: [],
    attempts
  };
}

export async function createExporter(tab, options) {
  const rawRoot = options.rawRoot;
  const outputRoot = options.outputRoot;
  const subjects = options.subjects;
  await fs.mkdir(rawRoot, { recursive: true });
  await fs.mkdir(outputRoot, { recursive: true });

  async function subjectFile(termValue, subject) {
    const directory = path.join(rawRoot, termValue);
    await fs.mkdir(directory, { recursive: true });
    return path.join(directory, `${subject}.json`);
  }

  async function isDone(termValue, subject) {
    try {
      const payload = JSON.parse(await fs.readFile(
        await subjectFile(termValue, subject),
        "utf8"
      ));
      return payload.ok === true &&
        ["data", "confirmed_empty"].includes(payload.status);
    } catch {
      return false;
    }
  }

  async function status(termValue) {
    let completed = 0;
    for (const subject of subjects) {
      if (await isDone(termValue, subject)) completed += 1;
    }
    return { term: TERMS[termValue].label, completed, total: subjects.length };
  }

  async function runBatch(termValue, batchSize = 4) {
    const pending = [];
    for (const subject of subjects) {
      if (!(await isDone(termValue, subject))) pending.push(subject);
    }

    const batch = pending.slice(0, batchSize);
    for (const subject of batch) {
      let payload;
      try {
        const result = await querySubject(tab, termValue, subject);
        const verified = ["data", "confirmed_empty"].includes(result.status);
        payload = {
          termValue,
          subject,
          ok: verified,
          status: result.status,
          startedAt: result.attempts[0]?.startedAt,
          completedAt: result.attempts.at(-1)?.completedAt,
          attempts: result.attempts,
          emptyEvidence: result.status !== "data"
            ? result.attempts.map((item) => item.emptyEvidence)
            : null,
          error: verified ? null : "CUSIS returned an unverified blank result",
          records: result.records
        };
      } catch (error) {
        payload = {
          termValue,
          subject,
          ok: false,
          status: "failed",
          completedAt: new Date().toISOString(),
          error: error.message,
          records: []
        };
      }
      await fs.writeFile(
        await subjectFile(termValue, subject),
        JSON.stringify(payload),
        "utf8"
      );
    }
    return status(termValue);
  }

  async function finalize(termValue) {
    const allRecords = [];
    const failures = [];
    const missing = [];

    for (const subject of subjects) {
      try {
        const payload = JSON.parse(await fs.readFile(
          await subjectFile(termValue, subject),
          "utf8"
        ));
        if (payload.ok && ["data", "confirmed_empty"].includes(payload.status)) {
          allRecords.push(...payload.records);
        }
        else failures.push({ subject, error: payload.error });
      } catch {
        missing.push(subject);
      }
    }

    const classes = new Map();
    for (const record of allRecords) {
      const key = [
        record["Class Nbr"],
        record["Course Component"],
        record["Section Code"]
      ].join("|");
      if (!classes.has(key)) {
        classes.set(key, {
          ...record,
          Meetings: []
        });
      }
      classes.get(key).Meetings.push([
        record.Period,
        record.Room,
        record["Meeting Date"]
      ].filter(Boolean).join(" · "));
    }

    const classRecords = [...classes.values()].map((record) => ({
      ...record,
      Meetings: [...new Set(record.Meetings)].join(" | ")
    }));
    const subjectsWithClasses = [...new Set(
      allRecords.map((row) => row["Queried Subject"])
    )].sort();
    const subjectsWithoutClasses = subjects.filter(
      (subject) => !subjectsWithClasses.includes(subject)
    );
    const prefix = `cuhk-timetable-2026-27-${TERMS[termValue].slug}`;
    const outputNames = options.canonicalNames
      ? { meetings: "meetings.csv", classes: "classes.csv", full: "full.json" }
      : {
          meetings: `${prefix}-meetings.csv`,
          classes: `${prefix}-classes.csv`,
          full: `${prefix}.json`
        };
    const meetingHeaders = [
      "Academic Term", "Term Value", "Queried Subject", ...HEADERS
    ];
    const classHeaders = [
      ...meetingHeaders.filter((header) =>
        !["Period", "Room", "Meeting Date"].includes(header)
      ),
      "Meetings"
    ];
    const metadata = {
      source: "CUHK CUSIS Teaching Timetable by Subject/Department",
      exportedAt: new Date().toISOString(),
      academicTerm: TERMS[termValue].label,
      subjectCount: subjects.length,
      successfulSubjects: subjects.length - failures.length - missing.length,
      subjectsWithClasses: subjectsWithClasses.length,
      subjectsWithoutClasses,
      failedSubjects: failures,
      missingSubjects: missing,
      confirmedEmptySubjects: subjectsWithoutClasses,
      uniqueClassNumbers: new Set(allRecords.map((row) => row["Class Nbr"])).size,
      classComponents: classRecords.length,
      meetingRows: allRecords.length
    };

    await fs.writeFile(
      path.join(outputRoot, outputNames.meetings),
      `\uFEFF${toCsv(allRecords, meetingHeaders)}`,
      "utf8"
    );
    await fs.writeFile(
      path.join(outputRoot, outputNames.classes),
      `\uFEFF${toCsv(classRecords, classHeaders)}`,
      "utf8"
    );
    await fs.writeFile(
      path.join(outputRoot, outputNames.full),
      JSON.stringify({ metadata, classes: classRecords, meetings: allRecords }, null, 2),
      "utf8"
    );
    return metadata;
  }

  return { runBatch, status, finalize };
}
