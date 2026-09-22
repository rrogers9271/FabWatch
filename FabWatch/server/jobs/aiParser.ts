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
