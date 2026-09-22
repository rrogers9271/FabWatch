import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const LATEST_FILE = path.join(DATA_DIR, "latest.json");

function ensureDirectories() {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

export interface Snapshot {
  scrapedAt: string;
  listings: unknown[];
  expansions: unknown[];
  stats: unknown;
}

export function saveSnapshot(snapshot: Snapshot) {
  ensureDirectories();

  const json = JSON.stringify(snapshot, null, 2);

  fs.writeFileSync(LATEST_FILE, json, "utf8");

  const safeDate = snapshot.scrapedAt
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "Z");

  const archiveFile = path.join(
    ARCHIVE_DIR,
    `${safeDate}.json`
  );

  fs.writeFileSync(archiveFile, json, "utf8");

  return {
    latest: LATEST_FILE,
    archive: archiveFile,
  };
}

export function loadLatestSnapshot(): Snapshot | null {
  try {
    if (!fs.existsSync(LATEST_FILE)) return null;

    return JSON.parse(
      fs.readFileSync(LATEST_FILE, "utf8")
    ) as Snapshot;
  } catch (error) {
    console.error("[snapshot] unable to read latest.json:", error);
    return null;
  }
}
