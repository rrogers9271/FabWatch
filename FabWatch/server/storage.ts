import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { listings, expansions, alertRules, users } from "@shared/schema";
import type { Listing, InsertListing, Expansion, InsertExpansion, AlertRule, InsertAlertRule, User, InsertUser, SafeUser } from "@shared/schema";
import { createHash, randomBytes } from "node:crypto";

const sqlite = new Database("data.db");
const db = drizzle(sqlite);

export function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${createHash("sha256").update(salt + password).digest("hex")}`;
}
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  return createHash("sha256").update(salt + password).digest("hex") === hash;
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, broker TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', type TEXT NOT NULL,
    wafer_sizes TEXT NOT NULL DEFAULT '[]', square_footage INTEGER,
    power_capacity_mw REAL, state TEXT NOT NULL, city TEXT NOT NULL,
    lat REAL, lng REAL, asking_price TEXT, nodes TEXT NOT NULL DEFAULT '[]',
    seller TEXT, listed_date TEXT, notes TEXT, source_url TEXT
  );
  CREATE TABLE IF NOT EXISTS expansions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, company TEXT NOT NULL,
    state TEXT NOT NULL, city TEXT NOT NULL, lat REAL, lng REAL, type TEXT NOT NULL,
    investment_billions REAL, wafer_size TEXT, completion_year INTEGER,
    status TEXT NOT NULL DEFAULT 'planned', notes TEXT, source_url TEXT
  );
  CREATE TABLE IF NOT EXISTS alert_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL,
    min_sqft INTEGER, max_sqft INTEGER, wafer_size TEXT,
    types TEXT NOT NULL DEFAULT '[]', states TEXT NOT NULL DEFAULT '[]',
    min_power_mw REAL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT, stripe_subscription_id TEXT,
    stripe_subscription_status TEXT, trial_ends_at TEXT,
    created_at TEXT NOT NULL DEFAULT '', last_login_at TEXT
  );
`);

function toSafeUser(u: User): SafeUser { const { passwordHash: _, ...safe } = u; return safe; }

export class SqliteStorage {
  getAllListings(): Listing[] { return db.select().from(listings).all(); }
  getListing(id: number): Listing | undefined { return db.select().from(listings).where(eq(listings.id, id)).get(); }
  createListing(data: InsertListing): Listing { return db.insert(listings).values(data).returning().get(); }
  updateListing(id: number, data: Partial<InsertListing>): Listing | undefined {
    db.update(listings).set(data).where(eq(listings.id, id)).run(); return this.getListing(id);
  }
  deleteListing(id: number): void { db.delete(listings).where(eq(listings.id, id)).run(); }
  getAllExpansions(): Expansion[] { return db.select().from(expansions).all(); }
  createExpansion(data: InsertExpansion): Expansion { return db.insert(expansions).values(data).returning().get(); }
  deleteExpansion(id: number): void { db.delete(expansions).where(eq(expansions.id, id)).run(); }
  getAllAlertRules(): AlertRule[] { return db.select().from(alertRules).all(); }
  createAlertRule(data: InsertAlertRule): AlertRule {
    return db.insert(alertRules).values({ ...data, createdAt: new Date().toISOString() }).returning().get();
  }
  updateAlertRule(id: number, data: Partial<InsertAlertRule>): AlertRule | undefined {
    db.update(alertRules).set(data).where(eq(alertRules.id, id)).run();
    return db.select().from(alertRules).where(eq(alertRules.id, id)).get();
  }
  deleteAlertRule(id: number): void { db.delete(alertRules).where(eq(alertRules.id, id)).run(); }

  createUser(email: string, password: string): SafeUser {
    const user = db.insert(users).values({ email: email.toLowerCase().trim(), passwordHash: createPasswordHash(password), tier: "free", createdAt: new Date().toISOString() }).returning().get();
    return toSafeUser(user);
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get();
  }
  getUserById(id: number): SafeUser | undefined {
    const user = db.select().from(users).where(eq(users.id, id)).get();
    return user ? toSafeUser(user) : undefined;
  }
  updateUserStripe(id: number, data: { stripeCustomerId?: string; stripeSubscriptionId?: string; stripeSubscriptionStatus?: string; tier?: string }): void {
    db.update(users).set(data).where(eq(users.id, id)).run();
  }
  updateUserLastLogin(id: number): void {
    db.update(users).set({ lastLoginAt: new Date().toISOString() }).where(eq(users.id, id)).run();
  }

  getAllEquipment(): any[] { return (db as any).select().from((equipment as any)).all(); }
  getEquipment(id: number): any { return (db as any).select().from((equipment as any)).where((eq as any)((equipment as any).id, id)).get(); }
  createEquipment(data: any): any { return (db as any).insert((equipment as any)).values(data).returning().get(); }
  deleteEquipment(id: number): void { (db as any).delete((equipment as any)).where((eq as any)((equipment as any).id, id)).run(); }

  seedIfEmpty(): void {
    if (this.getAllListings().length > 0) return;
    const sl: InsertListing[] = [
      { name: "Wolfspeed Farmers Branch Epitaxy Campus", broker: "LoopNet / Direct", status: "active", type: "fab", waferSizes: JSON.stringify(["150mm"]), squareFootage: 457000, powerCapacityMW: 14, state: "TX", city: "Farmers Branch", lat: 32.926, lng: -96.889, askingPrice: "Undisclosed", nodes: JSON.stringify(["SiC Epitaxy","GaN","150mm"]), seller: "Wolfspeed", listedDate: "2025-01", notes: "4-building campus on 26 acres. Bldg A is 162,500 sf fab. Bldg G is a 14MW data center expandable to 28MW. Post-bankruptcy disposition.", sourceUrl: "https://www.datacenterdynamics.com/en/news/chipmaker-wolfspeed-closes-texas-site-puts-up-for-sale/" },
      { name: "Wolfspeed Durham 150mm Device Fab", broker: "ATREG / Direct", status: "active", type: "fab", waferSizes: JSON.stringify(["150mm"]), squareFootage: 120000, powerCapacityMW: 8, state: "NC", city: "Durham", lat: 35.994, lng: -78.899, askingPrice: "Undisclosed", nodes: JSON.stringify(["SiC","GaN","150mm Power"]), seller: "Wolfspeed", listedDate: "2025-H2", notes: "Shut down ahead of schedule in late 2025. Full 150mm SiC device production line. Part of Wolfspeed Chapter 11 restructuring.", sourceUrl: "https://assets.wolfspeed.com/uploads/2026/02/Wolfspeed_Q2_2026_Earnings_Release.pdf" },
      { name: "150mm Wafer Foundry – San Jose (Moov Technologies)", broker: "Moov Technologies", status: "active", type: "fab", waferSizes: JSON.stringify(["150mm","100mm"]), squareFootage: 5998, powerCapacityMW: 1.2, state: "CA", city: "San Jose", lat: 37.378, lng: -121.929, askingPrice: "Contact Broker", nodes: JSON.stringify(["Bipolar","BiCMOS","MEMS","150mm","100mm"]), seller: "Wafer Foundry.co", listedDate: "2025", notes: "5,998 sf Industrial/R&D condo. Full 150mm foundry with 10k wafer/yr capacity. For sale or lease including equipment.", sourceUrl: "https://site.moov.co/hubfs/Moov_FabSaleBrochure_v3_English.pdf" },
      { name: "ATREG 200mm/300mm Fab Portfolio – Western Hemisphere", broker: "ATREG", status: "active", type: "cleanroom", waferSizes: JSON.stringify(["200mm","300mm"]), squareFootage: null, powerCapacityMW: null, state: "US", city: "Multiple Locations", lat: 39.5, lng: -98.35, askingPrice: "Varies", nodes: JSON.stringify(["200mm","300mm","Cleanroom"]), seller: "Multiple Clients", listedDate: "2026-Q1", notes: "ATREG Q1 2026 newsletter: diverse portfolio of 200mm and 300mm fabs and cleanrooms available worldwide.", sourceUrl: "https://atreg.com/newsletters/atreg-fab-disposition-newsletter-and-semi-update-q1-2026/" },
      { name: "REC Silicon Butte Silane Gas Plant", broker: "Direct / TBD", status: "watch", type: "polysilicon", waferSizes: JSON.stringify([]), squareFootage: 280000, powerCapacityMW: 18, state: "MT", city: "Butte", lat: 46.003, lng: -112.535, askingPrice: "Undisclosed", nodes: JSON.stringify(["Polysilicon","Silane Gas","Solar-grade Si"]), seller: "REC Silicon", listedDate: "2025", notes: "Norwegian firm mulling sale after US-China trade war disruption. Produces silane gas & polysilicon.", sourceUrl: "https://www.pv-tech.org/snarled-in-the-trade-war-rec-silicon-mulls-sale-of-us-plant/" },
      { name: "Wolfspeed Mohawk Valley 200mm SiC Fab", broker: "Apollo Global / Direct", status: "watch", type: "fab", waferSizes: JSON.stringify(["200mm"]), squareFootage: 200000, powerCapacityMW: 40, state: "NY", city: "Marcy", lat: 43.164, lng: -75.245, askingPrice: "N/A – Restructuring", nodes: JSON.stringify(["SiC","200mm","Automotive-qualified"]), seller: "Wolfspeed / Apollo", listedDate: "2025-09", notes: "$1.2B joint investment with NY State. First 200mm SiC fab. Post-Chapter 11, Apollo acquired.", sourceUrl: "https://elevenflo.com/blog/wolfspeed-bankruptcy-46b-debt-restructuring" },
      { name: "Marcy Nanocenter Greenfield Site", broker: "ATREG / SUNY Poly", status: "active", type: "r_and_d", waferSizes: JSON.stringify(["200mm","300mm"]), squareFootage: 500000, powerCapacityMW: 50, state: "NY", city: "Marcy", lat: 43.165, lng: -75.246, askingPrice: "Incentives Available", nodes: JSON.stringify(["Greenfield","Shovel-ready","Advanced Mfg"]), seller: "NY State / SUNY", listedDate: "2025-Q1", notes: "Most shovel-ready greenfield site in the US per ATREG Q1 2025.", sourceUrl: "https://atreg.com/newsletters/" },
      { name: "Hanwha Polysilicon Facility – US (Exiting)", broker: "Direct", status: "watch", type: "polysilicon", waferSizes: JSON.stringify([]), squareFootage: 150000, powerCapacityMW: 12, state: "GA", city: "Cartersville", lat: 34.165, lng: -84.799, askingPrice: "TBD", nodes: JSON.stringify(["Polysilicon","Solar-grade Si"]), seller: "Hanwha Solutions", listedDate: "2025-01", notes: "Hanwha announced exit from US polysilicon manufacturing Jan 2025.", sourceUrl: "https://www.kedglobal.com/energy/newsView/ked202501030006" },
    ];
    for (const l of sl) this.createListing(l);
    const se: InsertExpansion[] = [
      { name: "TSMC Arizona Gigafab Complex", company: "TSMC", state: "AZ", city: "Phoenix", lat: 33.677, lng: -112.108, type: "logic", investmentBillions: 165, waferSize: "300mm", completionYear: 2030, status: "under_construction", notes: "12-fab long-term cluster. $165B committed.", sourceUrl: "https://business.times-online.com/times-online/article/tokenring-2026-1-28-silicon-sovereignty-tsmcs-165-billion-arizona-gigafab-redefines-the-ai-global-order" },
      { name: "Intel Fab 52/62 – Chandler", company: "Intel", state: "AZ", city: "Chandler", lat: 33.302, lng: -111.841, type: "logic", investmentBillions: 20, waferSize: "300mm", completionYear: 2027, status: "under_construction", notes: "Intel 18A process node. $20B Arizona investment.", sourceUrl: "https://www.intel.com/content/www/us/en/newsroom/news/intel-fab-arizona.html" },
      { name: "Micron DRAM Fab – Boise", company: "Micron Technology", state: "ID", city: "Boise", lat: 43.615, lng: -116.202, type: "memory", investmentBillions: 15, waferSize: "300mm", completionYear: 2030, status: "under_construction", notes: "CHIPS Act supported. Part of $50B+ national expansion plan.", sourceUrl: "https://www.industrialinfo.com/news/article/semiconductors-propel-idaho-to-27-billion-worth-of-under-construction-projects--342065" },
      { name: "Samsung Austin Fab Expansion", company: "Samsung", state: "TX", city: "Taylor", lat: 30.571, lng: -97.409, type: "logic", investmentBillions: 17, waferSize: "300mm", completionYear: 2026, status: "under_construction", notes: "CHIPS Act $6.4B grant recipient.", sourceUrl: "https://semiconductor.samsung.com/us/us-operations/" },
      { name: "Texas Instruments Richardson Fab", company: "Texas Instruments", state: "TX", city: "Richardson", lat: 32.948, lng: -96.729, type: "compound_semi", investmentBillions: 3.5, waferSize: "300mm", completionYear: 2026, status: "under_construction", notes: "300mm analog/mixed-signal fab.", sourceUrl: "https://www.ti.com/about-ti/company/ti-at-a-glance.html" },
      { name: "Wolfspeed Siler City Materials Factory", company: "Wolfspeed / Apollo", state: "NC", city: "Siler City", lat: 35.724, lng: -79.462, type: "sic", investmentBillions: 1.5, waferSize: "200mm", completionYear: 2025, status: "operational", notes: "World's largest 200mm SiC materials factory. Under Apollo ownership.", sourceUrl: "https://elevenflo.com/blog/wolfspeed-bankruptcy-46b-debt-restructuring" },
      { name: "Bosch Roseville SiC Fab (ex-TSI)", company: "Bosch", state: "CA", city: "Roseville", lat: 38.752, lng: -121.288, type: "sic", investmentBillions: 1.5, waferSize: "200mm", completionYear: 2026, status: "under_construction", notes: "Acquired from TSI via ATREG. Retooling for 200mm SiC.", sourceUrl: "https://www.businesswire.com/news/home/20230426005913/en/ATREG-Successfully-Advises-TSI-Semiconductors" },
      { name: "TOYO Polysilicon Supply – US Partner Site", company: "TOYO / US Partner", state: "TX", city: "TBD", lat: 31.0, lng: -99.0, type: "polysilicon", investmentBillions: 0.5, waferSize: null, completionYear: 2027, status: "planned", notes: "TOYO secured strategic US polysilicon supply partnership Jan 2026.", sourceUrl: "https://www.nasdaq.com/press-release/toyo-secures-strategic-polysilicon-supply-us-polysilicon-manufacturer-2026-01-07" },
    ];
    for (const e of se) this.createExpansion(e);
    this.createAlertRule({ label: "Large 200mm+ Fab — Southwest", minSqft: 50000, maxSqft: null, waferSize: "200mm", types: JSON.stringify(["fab","cleanroom"]), states: JSON.stringify(["AZ","TX","NM","NV","CA"]), minPowerMW: 5, active: 1, createdAt: new Date().toISOString() });
  }
}
export const storage = new SqliteStorage();
storage.seedIfEmpty();
