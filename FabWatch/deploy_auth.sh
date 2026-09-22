#!/usr/bin/env bash
# FabWatch Auth + Stripe Subscription Layer — Deployment Script
# Run from: /home/rogersr/fabwatch
# Usage:    bash deploy_auth.sh

set -e
APP="/home/rogersr/fabwatch"
cd "$APP"

echo "=== FabWatch Auth + Stripe Deployment ==="
echo "App root: $APP"
echo ""

# ── 1. Install stripe ─────────────────────────────────────────────────────────
echo "[1/9] Installing stripe..."
npm install stripe --save 2>&1 | tail -3

# ── 2. Write server/auth.ts ───────────────────────────────────────────────────
cat > server/auth.ts << 'EOF'
import type { Express, Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { storage, verifyPassword } from "./storage";
import { log } from "./index";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-10-28" })
  : null;

const PRICE_IDS: Record<string, string> = {
  monitor: process.env.STRIPE_PRICE_MONITOR ?? "",
  pro:     process.env.STRIPE_PRICE_PRO     ?? "",
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
  next();
}

export function requireTier(minTier: "free" | "monitor" | "pro") {
  const TIER_RANK: Record<string, number> = { free: 0, monitor: 1, pro: 2 };
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    const userTier = req.session.userTier ?? "free";
    if (TIER_RANK[userTier] < TIER_RANK[minTier]) {
      return res.status(403).json({ error: "Subscription required", required: minTier, current: userTier, upgradeUrl: "/#/pricing" });
    }
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (storage.getUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
      const user = storage.createUser(email, password);
      req.session.userId = user.id;
      req.session.userTier = user.tier;
      log(`registered: ${email}`, "auth");
      res.status(201).json({ user });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = storage.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
      storage.updateUserLastLogin(user.id);
      req.session.userId = user.id;
      req.session.userTier = user.tier;
      const { passwordHash: _, ...safeUser } = user;
      log(`login: ${email} (${user.tier})`, "auth");
      res.json({ user: safeUser });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/auth/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  });

  app.post("/api/subscribe", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const { tier } = req.body;
    const priceId = PRICE_IDS[tier];
    if (!priceId) return res.status(400).json({ error: "Invalid tier" });
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    try {
      let customerId = storage.getUserByEmail(user.email)?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { fabwatchUserId: String(user.id) } });
        customerId = customer.id;
        storage.updateUserStripe(user.id, { stripeCustomerId: customerId });
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId, mode: "subscription", payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/?subscribed=1`,
        cancel_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/pricing`,
        subscription_data: { trial_period_days: 7, metadata: { fabwatchUserId: String(user.id), tier } },
      });
      res.json({ url: session.url });
    } catch (e: any) { log(`Stripe error: ${e.message}`, "auth"); res.status(500).json({ error: e.message }); }
  });

  app.post("/api/stripe/webhook", (req, res, next) => next(), async (req, res) => {
    if (!stripe) return res.status(503).end();
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
    } catch (e: any) { return res.status(400).send(`Webhook error: ${e.message}`); }
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = parseInt(sub.metadata?.fabwatchUserId ?? "0");
          if (userId) {
            const newTier = sub.status === "active" || sub.status === "trialing" ? (sub.metadata?.tier ?? "monitor") : "free";
            storage.updateUserStripe(userId, { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status, tier: newTier });
            log(`subscription ${sub.status}: user ${userId} → ${newTier}`, "stripe");
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = parseInt(sub.metadata?.fabwatchUserId ?? "0");
          if (userId) { storage.updateUserStripe(userId, { stripeSubscriptionStatus: "canceled", tier: "free" }); log(`canceled: user ${userId} → free`, "stripe"); }
          break;
        }
      }
      res.json({ received: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/manage-subscription", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const userFull = storage.getUserByEmail(storage.getUserById(req.session.userId!)?.email ?? "");
    if (!userFull?.stripeCustomerId) return res.status(400).json({ error: "No active subscription" });
    const session = await stripe.billingPortal.sessions.create({ customer: userFull.stripeCustomerId, return_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/` });
    res.json({ url: session.url });
  });
}
EOF
echo "[2/9] Written server/auth.ts"

# ── 3. Write server/session.d.ts ──────────────────────────────────────────────
cat > server/session.d.ts << 'EOF'
import "express-session";
declare module "express-session" {
  interface SessionData {
    userId: number;
    userTier: string;
  }
}
EOF
echo "[3/9] Written server/session.d.ts"

# ── 4. Replace server/storage.ts ─────────────────────────────────────────────
cp server/storage.ts server/storage.ts.bak
cat > server/storage.ts << 'EOF'
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
EOF
echo "[4/9] Written server/storage.ts (backup at server/storage.ts.bak)"

# ── 5. Update shared/schema.ts — add users table ──────────────────────────────
if grep -q "export const users" shared/schema.ts; then
  echo "[5/9] shared/schema.ts already has users table — skipping"
else
  cat >> shared/schema.ts << 'EOF'

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tier: text("tier").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  trialEndsAt: text("trial_ends_at"),
  createdAt: text("created_at").notNull().default(""),
  lastLoginAt: text("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;
EOF
  echo "[5/9] Updated shared/schema.ts with users table"
fi

# ── 6. Patch server/index.ts — add session middleware ─────────────────────────
if grep -q "express-session" server/index.ts; then
  echo "[6/9] server/index.ts already has session — skipping"
else
  # Insert imports after last import line
  LAST=$(grep -n "^import" server/index.ts | tail -1 | cut -d: -f1)
  sed -i "${LAST}a import session from \"express-session\";\nimport MemoryStore from \"memorystore\";" server/index.ts
  # Insert session middleware before registerRoutes
  sed -i 's/await registerRoutes(httpServer, app);/const MemStore = MemoryStore(session);\n  app.use(session({\n    secret: process.env.SESSION_SECRET ?? "fabwatch-dev-secret",\n    resave: false,\n    saveUninitialized: false,\n    store: new MemStore({ checkPeriod: 86400000 }),\n    cookie: { secure: process.env.NODE_ENV === "production", httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 },\n  }));\n\n  await registerRoutes(httpServer, app);/' server/index.ts
  echo "[6/9] Patched server/index.ts with session middleware"
fi

# ── 7. Patch server/routes.ts — add auth import and tier gates ────────────────
if grep -q "registerAuthRoutes" server/routes.ts; then
  echo "[7/9] server/routes.ts already patched — skipping"
else
  # Add import at top
  sed -i '1s/^/import { registerAuthRoutes, requireTier } from ".\/auth";\n/' server/routes.ts
  # Add registerAuthRoutes call at start of registerRoutes function body
  sed -i 's/export function registerRoutes(httpServer: Server, app: Express) {/export function registerRoutes(httpServer: Server, app: Express) {\n  registerAuthRoutes(app);\n/' server/routes.ts
  # Gate listings and expansions behind monitor tier
  sed -i 's/app.get("\/api\/listings", (_req/app.get("\/api\/listings", requireTier("monitor"), (_req/' server/routes.ts
  sed -i 's/app.get("\/api\/expansions", (_req/app.get("\/api\/expansions", requireTier("monitor"), (_req/' server/routes.ts
  sed -i 's/app.get("\/api\/scheduler\/status", (_req/app.get("\/api\/scheduler\/status", requireTier("monitor"), (_req/' server/routes.ts
  echo "[7/9] Patched server/routes.ts with auth and tier gates"
fi

# ── 8. Write frontend pages ───────────────────────────────────────────────────
mkdir -p client/src/pages

cat > client/src/pages/Login.tsx << 'EOF'
import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
type Mode = "login" | "register";
export default function LoginPage() {
  const [, navigate] = useHashLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const resp = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Something went wrong"); return; }
      navigate("/"); window.location.reload();
    } catch { setError("Network error"); } finally { setLoading(false); }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"hsl(var(--background))" }}>
      <div style={{ width:"360px", background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:"9px", padding:"32px" }}>
        <div style={{ marginBottom:"24px" }}>
          <div style={{ fontSize:"11px", fontFamily:"var(--font-mono)", color:"hsl(197 100% 40%)", marginBottom:"6px" }}>FABWATCH</div>
          <h1 style={{ fontSize:"18px", fontWeight:600, color:"hsl(var(--foreground))" }}>{mode === "login" ? "Sign in" : "Create account"}</h1>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", display:"block", marginBottom:"4px" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="you@company.com"
              style={{ width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"13px", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", display:"block", marginBottom:"4px" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder={mode === "register" ? "Min. 8 characters" : ""}
              style={{ width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"13px", boxSizing:"border-box" }} />
          </div>
          {error && <div style={{ fontSize:"12px", color:"hsl(0 70% 55%)", padding:"8px 10px", background:"hsl(0 70% 10%)", borderRadius:"4px" }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading || !email || !password}
            style={{ padding:"9px", borderRadius:"6px", background:"hsl(197 100% 40%)", color:"#000", fontWeight:600, fontSize:"13px", border:"none", cursor:"pointer", opacity:loading ? 0.7 : 1 }}>
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <div style={{ fontSize:"12px", textAlign:"center", color:"hsl(var(--muted-foreground))" }}>
            {mode === "login" ? "No account? " : "Already registered? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ background:"none", border:"none", color:"hsl(197 100% 40%)", cursor:"pointer", fontSize:"12px", padding:0 }}>
              {mode === "login" ? "Create one free" : "Sign in"}
            </button>
          </div>
          {mode === "register" && <p style={{ fontSize:"10px", color:"hsl(var(--muted-foreground))", lineHeight:1.5, textAlign:"center" }}>By registering you confirm you are a US person or entity and agree to use this data for lawful purposes only.</p>}
        </div>
      </div>
    </div>
  );
}
EOF

cat > client/src/pages/Pricing.tsx << 'EOF'
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
const TIERS = [
  { id:"free", name:"Free", price:"$0", period:"", description:"Overview and aggregate statistics", features:["Dashboard with summary stats","Facility map (pins only)","Alert criteria browser","No live data feed"], cta:"Current plan", disabled:true, highlight:false },
  { id:"monitor", name:"Monitor", price:"$29", period:"/month", description:"Full live intelligence feed", features:["All free features","Live listings with full details","Expansion project database","6-hour auto-refresh","Source links and notes","7-day free trial"], cta:"Start free trial", disabled:false, highlight:true },
  { id:"pro", name:"Pro", price:"$99", period:"/month", description:"API access and custom sources", features:["All Monitor features","REST API access","Custom alert webhooks","CSV / Excel export","Manual scrape trigger","Priority support"], cta:"Subscribe", disabled:false, highlight:false },
];
export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const { data: auth } = useQuery<{ user: { tier: string } }>({ queryKey:["/api/auth/me"], retry:false });
  const currentTier = auth?.user?.tier ?? "free";
  const handleSubscribe = async (tierId: string) => {
    if (tierId === "free") return;
    setLoading(tierId);
    try {
      const resp = await fetch("/api/subscribe", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ tier: tierId }) });
      const data = await resp.json();
      if (data.url) window.location.href = data.url;
      else if (resp.status === 401) window.location.hash = "/login";
    } catch(e){ console.error(e); } finally { setLoading(null); }
  };
  return (
    <div style={{ padding:"40px 32px", maxWidth:"900px", margin:"0 auto" }}>
      <div style={{ marginBottom:"36px" }}>
        <h1 style={{ fontSize:"22px", fontWeight:600, color:"hsl(var(--foreground))", marginBottom:"8px" }}>FabWatch Intelligence</h1>
        <p style={{ fontSize:"14px", color:"hsl(var(--muted-foreground))", maxWidth:"480px" }}>Real-time monitoring of US semiconductor facility dispositions, CHIPS Act expansions, and fab acquisition intelligence.</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"16px" }}>
        {TIERS.map((tier) => {
          const isCurrent = currentTier === tier.id;
          return (
            <div key={tier.id} style={{ background:tier.highlight ? "hsl(var(--card))" : "hsl(var(--background))", border:tier.highlight ? "1px solid hsl(197 100% 40%)" : "1px solid hsl(var(--border))", borderRadius:"9px", padding:"24px", position:"relative" }}>
              {tier.highlight && <div style={{ position:"absolute", top:"-10px", left:"50%", transform:"translateX(-50%)", background:"hsl(197 100% 40%)", color:"#000", fontSize:"10px", fontWeight:600, padding:"2px 10px", borderRadius:"99px" }}>MOST POPULAR</div>}
              <div style={{ marginBottom:"16px" }}>
                <div style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", fontFamily:"var(--font-mono)", marginBottom:"4px" }}>{tier.name.toUpperCase()}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:"2px" }}>
                  <span style={{ fontSize:"28px", fontWeight:600, color:"hsl(var(--foreground))" }}>{tier.price}</span>
                  <span style={{ fontSize:"13px", color:"hsl(var(--muted-foreground))" }}>{tier.period}</span>
                </div>
                <p style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", marginTop:"6px" }}>{tier.description}</p>
              </div>
              <ul style={{ listStyle:"none", padding:0, margin:"0 0 20px 0" }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display:"flex", gap:"8px", alignItems:"flex-start", marginBottom:"8px" }}>
                    <span style={{ color:"hsl(142 60% 45%)", fontSize:"12px", marginTop:"1px", flexShrink:0 }}>✓</span>
                    <span style={{ fontSize:"12px", color:"hsl(var(--foreground))" }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => handleSubscribe(tier.id)} disabled={tier.disabled || isCurrent || loading === tier.id}
                style={{ width:"100%", padding:"9px 0", borderRadius:"6px", fontSize:"13px", fontWeight:500, cursor:tier.disabled || isCurrent ? "default" : "pointer", background:isCurrent ? "transparent" : tier.highlight ? "hsl(197 100% 40%)" : "hsl(var(--secondary))", color:isCurrent ? "hsl(var(--muted-foreground))" : tier.highlight ? "#000" : "hsl(var(--foreground))", border:isCurrent ? "1px solid hsl(var(--border))" : "none", opacity:(tier.disabled && !isCurrent) ? 0.5 : 1 }}>
                {loading === tier.id ? "Redirecting…" : isCurrent ? "Current plan" : tier.cta}
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop:"32px", padding:"16px", borderRadius:"6px", background:"hsl(var(--muted))", fontSize:"11px", color:"hsl(var(--muted-foreground))", lineHeight:1.6 }}>
        <strong style={{ color:"hsl(var(--foreground))" }}>Disclaimer:</strong> FabWatch provides curated public-source intelligence for informational purposes only. Content does not constitute investment advice, legal counsel, or securities recommendations. Data accuracy is not guaranteed. FabWatch is not affiliated with ATREG, Heritage Global, Macquarie, or any listed broker. Access to ITAR-adjacent facility data is restricted to US persons and entities.
      </div>
    </div>
  );
}
EOF
echo "[8/9] Written client/src/pages/Login.tsx and Pricing.tsx"

# ── 9. Add env vars ───────────────────────────────────────────────────────────
if grep -q "SESSION_SECRET" .env; then
  echo "[9/9] SESSION_SECRET already in .env — skipping session secret"
else
  SESSION_SECRET="fabwatch-$(openssl rand -hex 32)"
  echo "SESSION_SECRET=$SESSION_SECRET" >> .env
  echo "[9/9] Generated SESSION_SECRET and added to .env"
fi

echo ""
echo "=== Now add these to .env (replace with real values): ==="
echo ""
echo "  STRIPE_SECRET_KEY=sk_live_..."
echo "  STRIPE_WEBHOOK_SECRET=whsec_..."
echo "  STRIPE_PRICE_MONITOR=price_..."
echo "  STRIPE_PRICE_PRO=price_..."
echo "  APP_URL=https://your-domain.com    (or http://192.168.1.226:5000 for LAN)"
echo ""
echo "=== Then add routes to App.tsx, rebuild, and restart: ==="
echo ""
echo "  # In App.tsx add:"
echo "  # import LoginPage from '@/pages/Login';"
echo "  # import PricingPage from '@/pages/Pricing';"
echo "  # <Route path='/login' component={LoginPage} />"
echo "  # <Route path='/pricing' component={PricingPage} />"
echo ""
echo "  npm run build && pm2 restart fabwatch --update-env && pm2 logs fabwatch --lines 20"
echo ""
echo "=== Stripe setup (dashboard.stripe.com): ==="
echo "  1. Create product 'FabWatch Monitor' — $29/month recurring — copy price ID"
echo "  2. Create product 'FabWatch Pro' — $99/month recurring — copy price ID"
echo "  3. Add webhook endpoint: POST /api/stripe/webhook"
echo "     Events: customer.subscription.created/updated/deleted, invoice.payment_failed"
echo "  4. Copy webhook signing secret"

