(() => {
  "use strict";

  if (window.top !== window || document.getElementById("cuhk-exporter-panel")) return;

  const COMPONENT_URL_FRAGMENT = "CU_SCR_MENU.CU_TMSR801.GBL";
  const FRAME_ID = "main_target_win0";
  const SUBJECT_INPUT_ID = "CU_RC_TMSR801_SUBJECT";
  const SEARCH_ACTION_ID = "CU_RC_TMSR801_SSR_PB_CLASS_SRCH";
  const GRID_ID = "CLASS_LIST$scroll$0";
  const { EXPECTED_HEADERS, parseRows } = globalThis.CUHKTimetableParser;

  const state = {
    running: false,
    stopRequested: false,
    records: [],
    failures: [],
    term: "",
    startedAt: null
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function waitFor(check, timeoutMs = 20000, intervalMs = 150) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        try {
          const value = check();
          if (value) return resolve(value);
        } catch (_) {
          // The iframe can briefly be cross-document while PeopleSoft navigates.
        }
        if (Date.now() - started >= timeoutMs) {
          reject(new Error("Timed out waiting for CUSIS"));
          return;
        }
        setTimeout(poll, intervalMs);
      };
      poll();
    });
  }

  function getFrameDocument() {
    return document.getElementById(FRAME_ID)?.contentDocument || null;
  }

  function findTimetableNavLink() {
    return [...document.querySelectorAll("a")].find((link) =>
      link.href?.includes(COMPONENT_URL_FRAGMENT) ||
      /Teaching Timetable by Subj\/Dpt/i.test(link.textContent || "")
    );
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      input.ownerDocument.defaultView.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function openFreshSearch() {
    const link = await waitFor(findTimetableNavLink);
    link.click();
    return waitFor(() => {
      const doc = getFrameDocument();
      const input = doc?.getElementById(SUBJECT_INPUT_ID);
      const search = doc?.getElementById(SEARCH_ACTION_ID);
      return input && search ? { doc, input, search } : null;
    });
  }

  function extractTerm(doc) {
    const select = doc.getElementById("CLASS_SRCH_WRK2_STRM$35$");
    return select?.selectedOptions?.[0]?.textContent?.trim() || "unknown-term";
  }

  async function searchSubject(subject) {
    const searchPage = await openFreshSearch();
    if (!state.term) state.term = extractTerm(searchPage.doc);
    setNativeValue(searchPage.input, subject);
    searchPage.search.click();

    const result = await waitFor(() => {
      const doc = getFrameDocument();
      const grid = doc?.getElementById(GRID_ID);
      if (grid) return { type: "grid", doc, grid };

      const text = doc?.body?.innerText || "";
      if (/No classes|no matching values|no results?|returned no|not valid|must select/i.test(text)) {
        return { type: "empty", doc };
      }
      return null;
    }, 30000);

    if (result.type === "empty") return [];
    return parseGrid(result.grid, subject);
  }

  function parseGrid(grid, queriedSubject) {
    const rows = [...grid.rows].map((row) =>
      [...row.cells].map((cell) => cell.innerText)
    );
    return parseRows(rows, {
      academicTerm: state.term,
      queriedSubject
    });
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }

  function toCsv(records) {
    const headers = ["Academic Term", "Queried Subject", ...EXPECTED_HEADERS];
    return [
      headers.map(csvCell).join(","),
      ...records.map((record) => headers.map((header) =>
        csvCell(record[header])
      ).join(","))
    ].join("\r\n");
  }

  function safeName(value) {
    return String(value || "unknown-term")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function download(filename, type, contents) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function getSubjects() {
    const response = await chrome.runtime.sendMessage({ type: "CUHK_GET_SUBJECTS" });
    const subjects = response?.subjects || [];
    if (!subjects.length) throw new Error("Could not load the official subject list");
    return subjects;
  }

  function updateStatus(text, progress = null) {
    panel.querySelector("[data-role=status]").textContent = text;
    if (progress !== null) panel.querySelector("progress").value = progress;
  }

  async function runExport() {
    if (state.running) return;
    state.running = true;
    state.stopRequested = false;
    state.records = [];
    state.failures = [];
    state.term = "";
    state.startedAt = new Date().toISOString();
    startButton.disabled = true;
    stopButton.disabled = false;

    try {
      const subjects = await getSubjects();
      progress.max = subjects.length;
      progress.value = 0;

      for (let index = 0; index < subjects.length; index += 1) {
        if (state.stopRequested) break;
        const subject = subjects[index].code;
        updateStatus(
          `${index + 1}/${subjects.length} · ${subject} · ${state.records.length} rows`,
          index
        );

        try {
          const records = await searchSubject(subject);
          state.records.push(...records);
        } catch (error) {
          state.failures.push({ subject, error: error.message });
        }

        progress.value = index + 1;
        await sleep(500);
      }

      const metadata = {
        source: "CUHK CUSIS Teaching Timetable by Subject/Department",
        academicTerm: state.term,
        startedAt: state.startedAt,
        completedAt: new Date().toISOString(),
        stoppedEarly: state.stopRequested,
        rowModel: "One row per class meeting; class data are repeated for split meeting rows.",
        rows: state.records.length,
        failures: state.failures
      };
      const base = `cuhk-timetable-${safeName(state.term)}`;
      download(`${base}.csv`, "text/csv;charset=utf-8", `\uFEFF${toCsv(state.records)}`);
      download(`${base}.json`, "application/json;charset=utf-8", JSON.stringify({
        metadata,
        records: state.records
      }, null, 2));

      updateStatus(
        `完成：${state.records.length} rows；失败 ${state.failures.length} subjects`,
        progress.max
      );
    } catch (error) {
      updateStatus(`失败：${error.message}`);
    } finally {
      state.running = false;
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  }

  const panel = document.createElement("section");
  panel.id = "cuhk-exporter-panel";
  panel.innerHTML = `
    <strong>CUHK Timetable Exporter</strong>
    <div data-role="status">已就绪；请保持本页面打开</div>
    <progress value="0" max="1"></progress>
    <div class="cuhk-exporter-actions">
      <button type="button" data-role="start">一键导出全部课程</button>
      <button type="button" data-role="stop" disabled>停止</button>
    </div>
  `;
  document.documentElement.appendChild(panel);

  const startButton = panel.querySelector("[data-role=start]");
  const stopButton = panel.querySelector("[data-role=stop]");
  const progress = panel.querySelector("progress");
  startButton.addEventListener("click", runExport);
  stopButton.addEventListener("click", () => {
    state.stopRequested = true;
    updateStatus("正在停止；当前查询完成后导出已有数据……");
  });
})();
