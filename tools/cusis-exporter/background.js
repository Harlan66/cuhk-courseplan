const PUBLIC_TIMETABLE_URL =
  "https://rgsntl.rgs.cuhk.edu.hk/rws_prd_applx2/Public/tt_dsp_timetable.aspx";

const FALLBACK_SUBJECTS = [
  "ACCT", "AIST", "ANTH", "ARAB", "ARCH", "ARTS", "ASEI", "BCHE",
  "BCME", "BECE", "BEHM", "BIOL", "BMBL", "BMED", "BMEG", "CDAS",
  "CENG", "CHED", "CHEM", "CHES", "CHLL", "CHLT", "CHPR", "CLCC",
  "CLCE", "CLCH", "CLCP", "CLED", "CMBI", "COMM", "COOP", "CSAT",
  "CSCI", "CUMT", "CURE", "DIPL", "DOTE", "DSPS", "ECON", "EDUC",
  "EEEN", "EESC", "ELED", "ELEG", "ELTU", "ENGE", "ENGG", "EPIN",
  "ESTR", "FAAS", "FINA", "FNSC", "FREN", "FTEC", "GDRS", "GECC",
  "GECW", "GEMC", "GENA", "GERM", "GESC", "GESH", "GEUC", "GEWS",
  "GEYS", "GLEF", "GLSD", "GPAD", "GPSU", "GRMD", "GRON", "HIST",
  "HKSL", "HTMG", "IASP", "IBBA", "IERG", "IMSC", "ITAL", "JASP",
  "KORE", "LAWS", "LDTE", "LING", "LSCI", "MAEG", "MASE", "MATH",
  "MBTE", "MEDF", "MEDU", "MGNT", "MIEG", "MKTG", "MUSC", "NSCI",
  "NURS", "PHAR", "PHED", "PHIL", "PHPC", "PHYS", "PSYC", "RMSC",
  "RUSS", "SBMS", "SEEM", "SOCI", "SOSC", "SOWK", "SPAN", "SPED",
  "SSMU", "STAR", "STAT", "THAI", "THEO", "TRAN", "UGCP", "UGEA",
  "UGEB", "UGEC", "UGED", "UGFH", "UGFN", "URSP"
];

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

async function fetchSubjects() {
  try {
    const response = await fetch(PUBLIC_TIMETABLE_URL, {
      credentials: "omit",
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const select = html.match(
      /<select[^>]+id=["']ddl_subject["'][^>]*>([\s\S]*?)<\/select>/i
    )?.[1];
    if (!select) throw new Error("Subject list was not found");

    const subjects = [...select.matchAll(
      /<option[^>]+value=["']([A-Z0-9]+)["'][^>]*>([\s\S]*?)<\/option>/gi
    )].map((match) => ({
      code: match[1].trim(),
      label: decodeHtml(match[2].replace(/<[^>]+>/g, "").trim())
    })).filter((item) => item.code);

    if (subjects.length < 50) throw new Error("Subject list is unexpectedly short");
    return subjects;
  } catch (error) {
    return FALLBACK_SUBJECTS.map((code) => ({ code, label: code }));
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CUHK_GET_SUBJECTS") return false;
  fetchSubjects().then((subjects) => sendResponse({ subjects }));
  return true;
});

