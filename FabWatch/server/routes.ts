import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertListingSchema, insertExpansionSchema, insertAlertRuleSchema } from "@shared/schema";
import { lastRun, runUpdateCycle } from "./jobs/scheduler";
import { SOURCES } from "./jobs/sources";
import { registerAuthRoutes, requireTier } from "./auth";

export function registerRoutes(httpServer: Server, app: Express) {
  registerAuthRoutes(app);

  // --- LISTINGS ---
  app.get("/api/listings", requireTier("monitor"), (_req, res) => {
    try { res.json(storage.getAllListings()); }
    catch (e) { res.status(500).json({ error: "Failed to fetch listings" }); }
  });
  app.get("/api/listings/:id", (req, res) => {
    const item = storage.getListing(parseInt(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.post("/api/listings", (req, res) => {
    try { res.status(201).json(storage.createListing(insertListingSchema.parse(req.body))); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });
  app.patch("/api/listings/:id", (req, res) => {
    const updated = storage.updateListing(parseInt(req.params.id), insertListingSchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/listings/:id", (req, res) => {
    storage.deleteListing(parseInt(req.params.id)); res.json({ ok: true });
  });

  // --- EXPANSIONS ---
  app.get("/api/expansions", requireTier("monitor"), (_req, res) => {
    try { res.json(storage.getAllExpansions()); }
    catch (e) { res.status(500).json({ error: "Failed to fetch expansions" }); }
  });
  app.post("/api/expansions", (req, res) => {
    try { res.status(201).json(storage.createExpansion(insertExpansionSchema.parse(req.body))); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });
  app.delete("/api/expansions/:id", (req, res) => {
    storage.deleteExpansion(parseInt(req.params.id)); res.json({ ok: true });
  });

  // --- EQUIPMENT ---
  app.get("/api/equipment", requireTier("monitor"), (_req, res) => {
    try { res.json(storage.getAllEquipment()); }
    catch (e) { res.status(500).json({ error: "Failed to fetch equipment" }); }
  });
  app.post("/api/equipment", (req, res) => {
    try { res.status(201).json(storage.createEquipment(req.body)); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });
  app.delete("/api/equipment/:id", (req, res) => {
    storage.deleteEquipment(parseInt(req.params.id)); res.json({ ok: true });
  });

  // --- ALERT RULES ---
  app.get("/api/alert-rules", (_req, res) => {
    try { res.json(storage.getAllAlertRules()); }
    catch (e) { res.status(500).json({ error: "Failed to fetch alert rules" }); }
  });
  app.post("/api/alert-rules", (req, res) => {
    try { res.status(201).json(storage.createAlertRule(insertAlertRuleSchema.parse(req.body))); }
    catch (e) { res.status(400).json({ error: String(e) }); }
  });
  app.patch("/api/alert-rules/:id", (req, res) => {
    const updated = storage.updateAlertRule(parseInt(req.params.id), insertAlertRuleSchema.partial().parse(req.body));
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });
  app.delete("/api/alert-rules/:id", (req, res) => {
    storage.deleteAlertRule(parseInt(req.params.id)); res.json({ ok: true });
  });

  // --- STATS ---
  app.get("/api/stats", (_req, res) => {
    const ls = storage.getAllListings();
    const exps = storage.getAllExpansions();
    res.json({
      active: ls.filter(l => l.status === "active").length,
      underContract: ls.filter(l => l.status === "under_contract").length,
      watch: ls.filter(l => l.status === "watch").length,
      totalSqft: ls.reduce((sum, l) => sum + (l.squareFootage || 0), 0),
      expansionInvestment: exps.reduce((sum, e) => sum + (e.investmentBillions || 0), 0),
      totalListings: ls.length,
      totalExpansions: exps.length,
    });
  });

  // --- SCHEDULER ---
  app.get("/api/scheduler/status", requireTier("monitor"), (_req, res) => {
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
    try { res.json({ ok: true, ...await runUpdateCycle() }); }
    catch (e) { res.status(500).json({ error: String(e) }); }
  });
}
