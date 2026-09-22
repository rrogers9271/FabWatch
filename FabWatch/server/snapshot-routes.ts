import type { Express } from "express";
import { saveSnapshot, loadLatestSnapshot } from "./snapshot";

export function registerSnapshotRoutes(
  app: Express,
  getData: () => {
    listings: unknown[];
    expansions: unknown[];
    stats: unknown;
  }
) {
  app.get("/api/snapshot/latest", (_req, res) => {
    const snapshot = loadLatestSnapshot();

    if (!snapshot) {
      return res.status(404).json({
        error: "No snapshot available",
      });
    }

    return res.json(snapshot);
  });

  app.post("/api/snapshot", (_req, res) => {
    try {
      const data = getData();

      const snapshot = {
        scrapedAt: new Date().toISOString(),
        listings: data.listings,
        expansions: data.expansions,
        stats: data.stats,
      };

      const files = saveSnapshot(snapshot);

      return res.json({
        ok: true,
        snapshot,
        files,
      });
    } catch (error) {
      console.error("[snapshot] save failed:", error);

      return res.status(500).json({
        error: "Unable to save snapshot",
      });
    }
  });
}
