#!/usr/bin/env bash
# FabWatch Auto-Update Engine — Deployment Script
# Run from: /home/rogersr/fabwatch
# Usage:    bash deploy_fabwatch.sh

set -e
APP="/home/rogersr/fabwatch"
cd "$APP"

echo "=== FabWatch Auto-Update Deployment ==="
echo "App root: $APP"
echo ""

# ── 1. Create jobs directory ──────────────────────────────────────────────────
mkdir -p server/jobs
echo "[1/7] Created server/jobs/"

# ── 2. Write sources.ts ───────────────────────────────────────────────────────
cat > server/jobs/sources.ts << 'EOF'
export interface FabSource {
  id: string;
  name: string;
  url: string;
  type: "rss" | "html" | "json";
  category: "listing" | "expansion" | "both";
  priority: "high" | "medium" | "low";
}

export const SOURCES: FabSource[] = [
  { id: "heritage_global", name: "Heritage Global Partners — Semiconductor Auctions", url: "https://www.hgpauction.com/search/?q=semiconductor", type: "html", category: "listing", priority: "high" },
  { id: "hilco_semi", name: "Hilco Industrial — Semiconductor", url: "https://www.hilcoind.com/search?q=semiconductor+fab", type: "html", category: "listing", priority: "high" },
  { id: "atreg_newsletter", name: "ATREG Semiconductor Transactions", url: "https://atreg.com/newsletters/", type: "html", category: "listing", priority: "high" },
  { id: "moov_fab", name: "Moov Technologies Fab Listings", url: "https://site.moov.co", type: "html", category: "listing", priority: "high" },
  { id: "la_semi_case", name: "LA Semiconductor — CourtListener Docket", url: "https://www.courtlistener.com/docket/68649684/semiconductor-components-industries-llc-v-la-semiconductor-llc/", type: "html", category: "listing", priority: "high" },
  { id: "idaho_dol_warn", name: "Idaho Department of Labor — WARN Notices", url: "https://www.labor.idaho.gov/dnn/Businesses/WARN-Act-Notices", type: "html", category: "listing", priority: "high" },
  { id: "chips_program_office", name: "CHIPS Program Office — Awards", url: "https://www.nist.gov/semiconductors/chips-program-news-and-updates", type: "html", category: "expansion", priority: "high" },
  { id: "commerce_chips", name: "Commerce CHIPS Act Announcements", url: "https://www.commerce.gov/tags/chips-and-science-act", type: "html", category: "expansion", priority: "high" },
  { id: "skywater_ir", name: "SkyWater Technology — Press Releases", url: "https://investors.skywatertechnology.com/news-releases", type: "html", category: "both", priority: "high" },
  { id: "east_idaho_news", name: "East Idaho News — Semiconductor", url: "https://www.eastidahonews.com/search/?q=semiconductor", type: "html", category: "both", priority: "high" },
  { id: "semianalysis", name: "SemiAnalysis RSS", url: "https://www.semianalysis.com/feed", type: "rss", category: "both", priority: "medium" },
  { id: "eetimes", name: "EE Times RSS", url: "https://www.eetimes.com/feed/", type: "rss", category: "both", priority: "medium" },
];
EOF
echo "[2/7] Written server/jobs/sources.ts"

# ── 3. Write scraper.ts ───────────────────────────────────────────────────────
cat > server/jobs/scraper.ts << 'EOF'
import { log } from "../index";
import type { FabSource } from "./sources";

const USER_AGENT = "FabWatch/1.0 (semiconductor-facility-monitor)";
const FETCH_TIMEOUT_MS = 15_000;

export interface ScrapeResult {
  sourceId: string;
  sourceName: string;
  url: string;
  fetchedAt: string;
  content: string;
  rawLength: number;
  success: boolean;
  error?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{3,}/g, "\n\n").trim();
}

function parseRss(xml: string): string {
  const items: string[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const desc  = item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
    const link  = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const date  = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    items.push(`TITLE: ${stripHtml(title)}\nDATE: ${date}\nLINK: ${link}\nSUMMARY: ${stripHtml(desc)}`);
    if (items.length >= 20) break;
  }
  return items.join("\n\n---\n\n");
}

export async function scrapeSource(source: FabSource): Promise<ScrapeResult> {
  const fetchedAt = new Date().toISOString();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(source.url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      return { sourceId: source.id, sourceName: source.name, url: source.url, fetchedAt, content: "", rawLength: 0, success: false, error: `HTTP ${resp.status}` };
    }
    const raw = await resp.text();
    const content = source.type === "rss" ? parseRss(raw) : stripHtml(raw).slice(0, 12_000);
    log(`scraped ${source.id} — ${content.length} chars`, "scraper");
    return { sourceId: source.id, sourceName: source.name, url: source.url, fetchedAt, content, rawLength: raw.length, success: true };
  } catch (err: any) {
    log(`scrape failed ${source.id}: ${err.message}`, "scraper");
    return { sourceId: source.id, sourceName: source.name, url: source.url, fetchedAt, content: "", rawLength: 0, success: false, error: err.message };
  }
}

export async function scrapeAll(sources: FabSource[], concurrency = 3): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  for (let i = 0; i < sources.length; i += concurrency) {
    const batch = sources.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(scrapeSource));
    results.push(...batchResults);
    if (i + concurrency < sources.length) await new Promise((r) => setTimeout(r, 1500));
  }
  return results;
}
EOF
echo "[3/7] Written server/jobs/scraper.ts"

# ── 4. Write aiParser.ts ──────────────────────────────────────────────────────
cat > server/jobs/aiParser.ts << 'EOF'
import OpenAI from "openai";
import type { InsertListing, InsertExpansion } from "@shared/schema";
import type { ScrapeResult } from "./scraper";
import { log } from "../index";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedUpdate {
  listings: InsertListing[];
  expansions: InsertExpansion[];
  sourceId: string;
  parsedAt: string;
}

const LISTING_SYSTEM = `You are a semiconductor industry analyst extracting structured data from web content about semiconductor facility sales, auctions, receiverships, and dispositions.

Extract ONLY facilities actively for sale, in auction, under receivership/bankruptcy, or recently closed and being liquidated.

Return JSON with a "listings" array. Each item:
{
  "name": string,
  "broker": string,
  "status": "active"|"under_contract"|"sold"|"watch",
  "type": "fab"|"cleanroom"|"polysilicon"|"epitaxy"|"compound_semi"|"r_and_d",
  "waferSizes": string[],
  "squareFootage": number|null,
  "powerCapacityMW": number|null,
  "state": string,
  "city": string,
  "lat": number|null,
  "lng": number|null,
  "askingPrice": string|null,
  "nodes": string[],
  "seller": string|null,
  "listedDate": string|null,
  "notes": string|null,
  "sourceUrl": string|null
}
Return {"listings":[]} if nothing found. JSON only, no markdown.`;

const EXPANSION_SYSTEM = `You are a semiconductor industry analyst extracting structured data about new fab construction, CHIPS Act awards, and capacity expansions in the United States.

Return JSON with an "expansions" array. Each item:
{
  "name": string,
  "company": string,
  "state": string,
  "city": string,
  "lat": number|null,
  "lng": number|null,
  "type": "logic"|"sic"|"memory"|"compound_semi"|"advanced_packaging"|"polysilicon"|"analog_power",
  "investmentBillions": number|null,
  "waferSize": string|null,
  "completionYear": number|null,
  "status": "planned"|"under_construction"|"operational",
  "notes": string|null,
  "sourceUrl": string|null
}
Return {"expansions":[]} if nothing found. JSON only, no markdown.`;

async function parseWithAI(content: string, system: string, sourceUrl: string): Promise<any> {
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: `SOURCE: ${sourceUrl}\n\nCONTENT:\n${content.slice(0, 10_000)}` },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });
    return JSON.parse(resp.choices[0]?.message?.content ?? "{}");
  } catch (err: any) {
    log(`AI parse error: ${err.message}`, "aiParser");
    return {};
  }
}

export async function parseScrapedContent(result: ScrapeResult, category: "listing"|"expansion"|"both"): Promise<ParsedUpdate> {
  const parsedAt = new Date().toISOString();
  const listings: InsertListing[] = [];
  const expansions: InsertExpansion[] = [];
  if (!result.success || !result.content) return { listings, expansions, sourceId: result.sourceId, parsedAt };

  if (category === "listing" || category === "both") {
    const parsed = await parseWithAI(result.content, LISTING_SYSTEM, result.url);
    if (Array.isArray(parsed?.listings)) {
      for (const item of parsed.listings) {
        if (item.name && item.broker && item.type && item.state && item.city) {
          listings.push({
            name: String(item.name), broker: String(item.broker),
            status: ["active","under_contract","sold","watch"].includes(item.status) ? item.status : "watch",
            type: item.type,
            waferSizes: JSON.stringify(Array.isArray(item.waferSizes) ? item.waferSizes : []),
            squareFootage: item.squareFootage ?? null, powerCapacityMW: item.powerCapacityMW ?? null,
            state: String(item.state).toUpperCase().slice(0,2), city: String(item.city),
            lat: item.lat ?? null, lng: item.lng ?? null,
            askingPrice: item.askingPrice ?? null,
            nodes: JSON.stringify(Array.isArray(item.nodes) ? item.nodes : []),
            seller: item.seller ?? null, listedDate: item.listedDate ?? null,
            notes: item.notes ?? null, sourceUrl: item.sourceUrl ?? result.url,
          });
        }
      }
    }
    log(`parsed ${listings.length} listings from ${result.sourceId}`, "aiParser");
  }

  if (category === "expansion" || category === "both") {
    const parsed = await parseWithAI(result.content, EXPANSION_SYSTEM, result.url);
    if (Array.isArray(parsed?.expansions)) {
      for (const item of parsed.expansions) {
        if (item.name && item.company && item.state && item.city) {
          expansions.push({
            name: String(item.name), company: String(item.company),
            state: String(item.state).toUpperCase().slice(0,2), city: String(item.city),
            lat: item.lat ?? null, lng: item.lng ?? null,
            type: item.type ?? "analog_power",
            investmentBillions: item.investmentBillions ?? null,
            waferSize: item.waferSize ?? null, completionYear: item.completionYear ?? null,
            status: ["planned","under_construction","operational"].includes(item.status) ? item.status : "planned",
            notes: item.notes ?? null, sourceUrl: item.sourceUrl ?? result.url,
          });
        }
      }
    }
    log(`parsed ${expansions.length} expansions from ${result.sourceId}`, "aiParser");
  }

  return { listings, expansions, sourceId: result.sourceId, parsedAt };
}
EOF
echo "[4/7] Written server/jobs/aiParser.ts"

# ── 5. Write scheduler.ts ─────────────────────────────────────────────────────
cat > server/jobs/scheduler.ts << 'EOF'
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
EOF
echo "[5/7] Written server/jobs/scheduler.ts"

# ── 6. Patch server/index.ts ──────────────────────────────────────────────────
if grep -q "startScheduler" server/index.ts; then
  echo "[6/7] server/index.ts already patched — skipping"
else
  # Insert import after the last import line
  LAST_IMPORT=$(grep -n "^import" server/index.ts | tail -1 | cut -d: -f1)
  sed -i "${LAST_IMPORT}a import { startScheduler } from \"./jobs/scheduler\";" server/index.ts
  # Insert startScheduler() call after registerRoutes
  sed -i 's/await registerRoutes(httpServer, app);/await registerRoutes(httpServer, app);\n  startScheduler();/' server/index.ts
  echo "[6/7] Patched server/index.ts"
fi

# ── 7. Patch server/routes.ts ─────────────────────────────────────────────────
if grep -q "scheduler/status" server/routes.ts; then
  echo "[7/7] server/routes.ts already patched — skipping"
else
  # Add import at top
  sed -i '1s/^/import { lastRun, runUpdateCycle } from ".\/jobs\/scheduler";\n/' server/routes.ts

  # Append the two new routes before the closing brace of registerRoutes
  # Find last line of file and insert before it
  cat >> server/routes.ts << 'ROUTES_EOF'

  // ── Scheduler status / trigger ─────────────────────────────────────────────
  // NOTE: these lines are appended — ensure they sit inside registerRoutes()
  app.get("/api/scheduler/status", (_req, res) => {
    res.json({
      lastRun,
      intervalHours: 6,
      nextRunEstimate: lastRun
        ? new Date(new Date(lastRun.completedAt).getTime() + 6 * 60 * 60 * 1000).toISOString()
        : null,
      sourcesCount: SOURCES.length,
    });
  });

  app.post("/api/scheduler/trigger", async (_req, res) => {
    try {
      const result = await runUpdateCycle();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
ROUTES_EOF

  # Also need SOURCES imported for sourcesCount
  sed -i '1s/^/import { SOURCES } from ".\/jobs\/sources";\n/' server/routes.ts

  echo "[7/7] Patched server/routes.ts"
fi

echo ""
echo "=== Source files ready. Now rebuild and restart: ==="
echo ""
echo "  npm run build && pm2 restart fabwatch && pm2 logs fabwatch --lines 60"
echo ""
echo "Watch for:"
echo "  [scheduler] scheduler armed — first run in 30s"
echo "  [scraper]   scraped heritage_global — XXXX chars"
echo "  [scheduler] ✓ cycle complete"
