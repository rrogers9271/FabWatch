import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Listing, Expansion } from "@shared/schema";

declare const L: any;

const LISTING_COLORS: Record<string, string> = {
  active: "#22c55e",
  watch: "#f59e0b",
  under_contract: "#a78bfa",
  sold: "#6b7280",
};

const EXPANSION_COLORS: Record<string, string> = {
  logic: "#00c2ff",
  sic: "#a78bfa",
  memory: "#f59e0b",
  compound_semi: "#f472b6",
  advanced_packaging: "#34d399",
  polysilicon: "#4ade80",
  planned: "#94a3b8",
  under_construction: "#f59e0b",
  operational: "#22c55e",
};

function makeListingIcon(status: string) {
  const color = LISTING_COLORS[status] || "#00c2ff";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;border-radius:50%;
      background:${color};
      border:2px solid rgba(255,255,255,0.3);
      box-shadow:0 0 8px ${color}88;
      position:relative;
    ">
      <div style="position:absolute;inset:-4px;border-radius:50%;border:1px solid ${color}44;"></div>
    </div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function makeExpansionIcon(type: string) {
  const color = EXPANSION_COLORS[type] || "#00c2ff";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;
      background:${color}22;
      border:2px solid ${color};
      border-radius:3px;
      transform:rotate(45deg);
      box-shadow:0 0 10px ${color}66;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", "/api/listings"),
  });

  const { data: expansions = [] } = useQuery<Expansion[]>({
    queryKey: ["/api/expansions"],
    queryFn: () => apiRequest("GET", "/api/expansions"),
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (typeof L === "undefined") {
      console.warn("Leaflet not loaded");
      return;
    }

    const map = L.map(mapRef.current, {
      center: [38.5, -97],
      zoom: 4,
      zoomControl: true,
    });

    // Dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Add markers when data loads
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === "undefined") return;

    // Clear existing markers
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    // Add listing markers
    listings.forEach((l) => {
      if (!l.lat || !l.lng) return;
      const wafers = JSON.parse(l.waferSizes || "[]") as string[];
      const waferStr = wafers.length ? wafers.join(", ") : "—";
      const popup = `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#e2e8f0;min-width:220px;">
          <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:6px;line-height:1.3;">${l.name}</div>
          <div style="color:#94a3b8;margin-bottom:8px;">${l.city}, ${l.state}</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#64748b;padding:2px 0;width:90px;">Status</td><td style="color:#e2e8f0;">${l.status}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Type</td><td style="color:#e2e8f0;">${l.type}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Wafer Size</td><td style="color:#00c2ff;">${waferStr}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Sq Ft</td><td style="color:#e2e8f0;">${l.squareFootage ? l.squareFootage.toLocaleString() + " sf" : "—"}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Power</td><td style="color:#e2e8f0;">${l.powerCapacityMW ? l.powerCapacityMW + " MW" : "—"}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Broker</td><td style="color:#e2e8f0;">${l.broker}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Price</td><td style="color:#f59e0b;">${l.askingPrice || "—"}</td></tr>
          </table>
          ${l.sourceUrl ? `<a href="${l.sourceUrl}" target="_blank" style="color:#00c2ff;font-size:11px;display:inline-block;margin-top:8px;">↗ Source</a>` : ""}
        </div>
      `;
      L.marker([l.lat, l.lng], { icon: makeListingIcon(l.status) })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 280, className: "fab-popup" });
    });

    // Add expansion markers
    expansions.forEach((e) => {
      if (!e.lat || !e.lng) return;
      const popup = `
        <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#e2e8f0;min-width:220px;">
          <div style="font-weight:700;font-size:13px;color:#fff;margin-bottom:6px;line-height:1.3;">${e.name}</div>
          <div style="color:#94a3b8;margin-bottom:8px;">${e.company} · ${e.city}, ${e.state}</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#64748b;padding:2px 0;width:90px;">Type</td><td style="color:#e2e8f0;">${e.type}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Status</td><td style="color:#f59e0b;">${e.status.replace(/_/g," ")}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Investment</td><td style="color:#22c55e;">${e.investmentBillions ? "$" + e.investmentBillions + "B" : "—"}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Wafer</td><td style="color:#00c2ff;">${e.waferSize || "—"}</td></tr>
            <tr><td style="color:#64748b;padding:2px 0;">Est. Complete</td><td style="color:#e2e8f0;">${e.completionYear || "—"}</td></tr>
          </table>
          ${e.notes ? `<div style="color:#64748b;font-size:11px;margin-top:8px;line-height:1.5;">${e.notes.slice(0, 120)}...</div>` : ""}
        </div>
      `;
      L.marker([e.lat, e.lng], { icon: makeExpansionIcon(e.type) })
        .addTo(map)
        .bindPopup(popup, { maxWidth: 280, className: "fab-popup" });
    });

  }, [listings, expansions]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Facility Map</h1>
          <div className="page-subtitle">Active listings vs. fab cluster expansion pipeline</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span className="badge badge-active">● Circles = Listings</span>
          <span className="badge badge-watch">◆ Diamonds = Expansions</span>
        </div>
      </div>

      <div className="map-container" style={{ position: "relative" }}>
        <div id="fab-map" ref={mapRef} style={{ height: "calc(100dvh - 81px)", width: "100%" }} data-testid="map-container" />

        {/* Legend */}
        <div className="map-legend">
          <div className="legend-title">Listing Status</div>
          {Object.entries({ active: "Active", watch: "Watch", under_contract: "Under Contract", sold: "Sold" }).map(([k, v]) => (
            <div key={k} className="legend-item">
              <div className="legend-dot" style={{ background: LISTING_COLORS[k] }} />
              {v}
            </div>
          ))}
          <div className="legend-title" style={{ marginTop: "12px" }}>Expansion Type</div>
          {Object.entries({ logic: "Logic / CMOS", sic: "SiC Power", memory: "DRAM/NAND", polysilicon: "Polysilicon", compound_semi: "Compound Semi" }).map(([k, v]) => (
            <div key={k} className="legend-item">
              <div className="legend-dot" style={{ background: EXPANSION_COLORS[k], borderRadius: "2px", transform: "rotate(45deg)" }} />
              {v}
            </div>
          ))}
        </div>

        <style>{`
          .fab-popup .leaflet-popup-content-wrapper {
            background: #0f1623;
            border: 1px solid #1e293b;
            border-radius: 8px;
            color: #e2e8f0;
            box-shadow: 0 12px 32px rgba(0,0,0,0.6);
          }
          .fab-popup .leaflet-popup-tip {
            background: #0f1623;
          }
          .fab-popup .leaflet-popup-close-button {
            color: #64748b;
          }
          .leaflet-control-zoom a {
            background: #0f1623 !important;
            color: #e2e8f0 !important;
            border-color: #1e293b !important;
          }
          .leaflet-control-zoom a:hover {
            background: #1e293b !important;
          }
          .leaflet-control-attribution {
            background: rgba(15,22,35,0.7) !important;
            color: #475569 !important;
            font-size: 9px !important;
          }
          .leaflet-control-attribution a { color: #64748b !important; }
        `}</style>
      </div>
    </>
  );
}
