import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const snapshotRoot = process.argv[2];
if (!snapshotRoot) {
  console.error("Usage: node tools/seal-cusis-snapshot.mjs <snapshot-directory>");
  process.exit(1);
}

const resolvedRoot = path.resolve(snapshotRoot);
const projectSnapshotsRoot = path.resolve("data/cuhk-timetable/snapshots");
if (!resolvedRoot.startsWith(`${projectSnapshotsRoot}${path.sep}`)) {
  throw new Error(`Snapshot must be inside ${projectSnapshotsRoot}`);
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "snapshot.json") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

const files = await walk(resolvedRoot);
if (!files.length) throw new Error("Refusing to seal an empty snapshot");

const checksumsSha256 = {};
for (const absolute of files) {
  const relative = path.relative(resolvedRoot, absolute);
  const contents = await fs.readFile(absolute);
  checksumsSha256[relative] = crypto.createHash("sha256").update(contents).digest("hex");
}

const termMetadata = [];
for (const absolute of files.filter((file) => file.endsWith("full.json"))) {
  const payload = JSON.parse(await fs.readFile(absolute, "utf8"));
  if (payload.metadata) {
    termMetadata.push({
      file: path.relative(resolvedRoot, absolute),
      ...payload.metadata
    });
  }
}

const manifest = {
  schemaVersion: 1,
  snapshotId: path.basename(resolvedRoot),
  sealed: true,
  sealedAt: new Date().toISOString(),
  immutablePolicy: "Do not overwrite, edit or delete files in a sealed snapshot.",
  fileCount: files.length,
  terms: termMetadata,
  checksumsSha256
};

await fs.writeFile(
  path.join(resolvedRoot, "snapshot.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { encoding: "utf8", flag: "wx" }
);

console.log(JSON.stringify({
  snapshot: resolvedRoot,
  files: files.length,
  terms: termMetadata.length,
  sealed: true
}, null, 2));
