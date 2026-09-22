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
