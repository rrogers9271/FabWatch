import { log } from "../index";
import { storage } from "../storage";
import { SOURCES } from "./sources";
import { scrapeAll } from "./scraper";
import { parseScrapedContent } from "./aiParser";
import type { InsertListing, InsertExpansion } from "@shared/schema";

const INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function deduplicateListings(incoming: InsertListing[], existing: { name: string; state: string }[]): InsertListing[] {
  const keys = new Set(existing.map((e) => `${normalize(e.name)}::${e.state.toLowerCase()}`));
  return incoming.filter((i) => !keys.has(`${normalize(i.name)}::${i.state.toLowerCase()}`));
}

function deduplicateExpansions(incoming: InsertExpansion[], existing: { name: string; state: string }[]): InsertExpansion[] {
  const keys = new Set(existing.map((e) => `${normalize(e.name)}::${e.state.toLowerCase()}`));
  return incoming.filter((i) => !keys.has(`${normalize(i.name)}::${i.state.toLowerCase()}`));
}

export let lastRun: { completedAt: string; newListings: number; newExpansions: number; errors: number } | null = null;

export async function runUpdateCycle(): Promise<typeof lastRun> {
  log("▶ update cycle starting", "scheduler");

  if (!process.env.OPENAI_API_KEY) {
    log("⚠ OPENAI_API_KEY not set — skipping", "scheduler");
    const result = { completedAt: new Date().toISOString(), newListings: 0, newExpansions: 0, errors: 0 };
    lastRun = result;
    return result;
  }

  let newListings = 0, newExpansions = 0, errors = 0;

  const sorted = [...SOURCES].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));
  const scrapeResults = await scrapeAll(sorted, 3);
  errors = scrapeResults.filter((r) => !r.success).length;

  const existingListings = storage.getAllListings().map((l) => ({ name: l.name, state: l.state }));
  const existingExpansions = storage.getAllExpansions().map((e) => ({ name: e.name, state: e.state }));

  for (const result of scrapeResults) {
    if (!result.success) continue;
    const source = SOURCES.find((s) => s.id === result.sourceId);
    if (!source) continue;
    try {
      const parsed = await parseScrapedContent(result, source.category);
      const freshListings = deduplicateListings(parsed.listings, existingListings);
      for (const listing of freshListings) {
        storage.createListing(listing);
        existingListings.push({ name: listing.name, state: listing.state });
        newListings++;
        log(`+ listing: ${listing.name} (${listing.state})`, "scheduler");
      }
      const freshExpansions = deduplicateExpansions(parsed.expansions, existingExpansions);
      for (const exp of freshExpansions) {
        storage.createExpansion(exp);
        existingExpansions.push({ name: exp.name, state: exp.state });
        newExpansions++;
        log(`+ expansion: ${exp.name} (${exp.state})`, "scheduler");
      }
    } catch (err: any) {
      log(`error processing ${result.sourceId}: ${err.message}`, "scheduler");
      errors++;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  const completedAt = new Date().toISOString();
  log(`✓ cycle complete — +${newListings} listings, +${newExpansions} expansions, ${errors} errors`, "scheduler");
  lastRun = { completedAt, newListings, newExpansions, errors };
  return lastRun;
}

export function startScheduler(): void {
  log(`scheduler armed — first run in ${INITIAL_DELAY_MS/1000}s, then every ${INTERVAL_MS/3600000}h`, "scheduler");
  setTimeout(async () => {
    await runUpdateCycle();
    setInterval(runUpdateCycle, INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
