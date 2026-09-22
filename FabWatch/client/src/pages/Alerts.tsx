import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AlertRule, InsertAlertRule, Listing } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

function matchesRule(rule: AlertRule, listing: Listing): boolean {
  const types = JSON.parse(rule.types || "[]") as string[];
  const states = JSON.parse(rule.states || "[]") as string[];
  const wafers = JSON.parse(listing.waferSizes || "[]") as string[];

  if (types.length > 0 && !types.includes(listing.type)) return false;
  if (states.length > 0 && !states.includes(listing.state)) return false;
  if (rule.minSqft && (!listing.squareFootage || listing.squareFootage < rule.minSqft)) return false;
  if (rule.maxSqft && listing.squareFootage && listing.squareFootage > rule.maxSqft) return false;
  if (rule.minPowerMW && (!listing.powerCapacityMW || listing.powerCapacityMW < rule.minPowerMW)) return false;
  if (rule.waferSize && !wafers.includes(rule.waferSize)) return false;
  return true;
}

function formatSqft(n: number | null) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M sf`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k sf`;
  return `${n} sf`;
}

function AddAlertModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");
  const [waferSize, setWaferSize] = useState("");
  const [minPowerMW, setMinPowerMW] = useState("");
  const [typesStr, setTypesStr] = useState("");
  const [statesStr, setStatesStr] = useState("");

  const mutation = useMutation({
    mutationFn: (data: InsertAlertRule) => apiRequest("POST", "/api/alert-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "Alert criteria added" });
      onClose();
    },
    onError: () => toast({ title: "Error adding rule", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!label) { toast({ title: "Label required", variant: "destructive" }); return; }
    const types = typesStr ? typesStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const states = statesStr ? statesStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    mutation.mutate({
      label,
      minSqft: minSqft ? parseInt(minSqft) : null,
      maxSqft: maxSqft ? parseInt(maxSqft) : null,
      waferSize: waferSize || null,
      types: JSON.stringify(types),
      states: JSON.stringify(states),
      minPowerMW: minPowerMW ? parseFloat(minPowerMW) : null,
      active: 1,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title">New Alert Criteria</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div style={{ background: "hsl(38 90% 50% / 0.08)", border: "1px solid hsl(38 90% 50% / 0.2)", borderRadius: "6px", padding: "10px 12px", marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "hsl(38 90% 65%)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>Weekly Alert</div>
            <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              New listings matching any active criteria will trigger a weekly digest alert. Leave criteria fields blank to match any value.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alert Label *</label>
            <input className="form-input" placeholder="e.g. Large 200mm Fab — Southwest" value={label} onChange={(e) => setLabel(e.target.value)} data-testid="input-alert-label" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Facility Types</label>
              <input className="form-input" placeholder="fab,cleanroom,polysilicon" value={typesStr} onChange={(e) => setTypesStr(e.target.value)} data-testid="input-alert-types" />
              <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "3px" }}>Comma-separated, or blank for any</div>
            </div>
            <div className="form-group">
              <label className="form-label">States</label>
              <input className="form-input" placeholder="AZ,TX,ID,NM" value={statesStr} onChange={(e) => setStatesStr(e.target.value)} data-testid="input-alert-states" />
              <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "3px" }}>2-letter codes, comma-separated</div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Min Sq Footage</label>
              <input className="form-input" type="number" placeholder="e.g. 50000" value={minSqft} onChange={(e) => setMinSqft(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Sq Footage</label>
              <input className="form-input" type="number" placeholder="Optional ceiling" value={maxSqft} onChange={(e) => setMaxSqft(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Wafer Size Filter</label>
              <select className="form-input" value={waferSize} onChange={(e) => setWaferSize(e.target.value)}>
                <option value="">Any Size</option>
                <option value="100mm">100mm</option>
                <option value="150mm">150mm</option>
                <option value="200mm">200mm</option>
                <option value="300mm">300mm</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Min Power (MW)</label>
              <input className="form-input" type="number" step="0.5" placeholder="e.g. 5" value={minPowerMW} onChange={(e) => setMinPowerMW(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending} data-testid="btn-submit-alert">
            {mutation.isPending ? "Saving..." : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { data: rules = [], isLoading: rulesLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/alert-rules"],
    queryFn: () => apiRequest("GET", "/api/alert-rules"),
  });

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", "/api/listings"),
  });

  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: number }) =>
      apiRequest("PATCH", `/api/alert-rules/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/alert-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-rules"] });
      toast({ title: "Alert rule removed" });
    },
  });

  const activeListings = listings.filter((l) => l.status === "active" || l.status === "watch");

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alert Criteria</h1>
          <div className="page-subtitle">Weekly digest — new listings matching these rules trigger an alert</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} data-testid="btn-add-alert">+ New Alert</button>
      </div>

      <div className="page-content">
        {/* Weekly schedule notice */}
        <div style={{
          background: "hsl(197 100% 40% / 0.07)",
          border: "1px solid hsl(197 100% 40% / 0.2)",
          borderRadius: "8px",
          padding: "14px 18px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}>
          <div style={{ fontSize: "20px" }}>◑</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "var(--text-xs)", color: "hsl(197 100% 65%)", marginBottom: "2px" }}>Weekly Alert Scan — Every Monday</div>
            <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
              FabWatch checks ATREG, Moov Technologies, LoopNet, and industry news each week for new listings.
              Any listing matching an active rule below triggers an in-app notification with details.
            </div>
          </div>
        </div>

        <div className="section-divider">Active Rules ({rules.filter((r) => r.active).length})</div>

        {rulesLoading ? (
          <div className="empty-state">Loading alert rules...</div>
        ) : rules.length === 0 ? (
          <div className="empty-state">No alert criteria yet — add one to start monitoring</div>
        ) : (
          <div style={{ marginBottom: "28px" }}>
            {rules.map((rule) => {
              const types = JSON.parse(rule.types || "[]") as string[];
              const states = JSON.parse(rule.states || "[]") as string[];
              const matches = activeListings.filter((l) => matchesRule(rule, l));
              return (
                <div key={rule.id} className="alert-card" data-testid={`alert-card-${rule.id}`}>
                  <div className="alert-card-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className={`badge ${rule.active ? "badge-active" : "badge-sold"}`} style={{ minWidth: "60px", justifyContent: "center" }}>
                        {rule.active ? "Active" : "Paused"}
                      </div>
                      <div className="alert-card-title">{rule.label}</div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleMutation.mutate({ id: rule.id, active: rule.active ? 0 : 1 })}
                        data-testid={`btn-toggle-alert-${rule.id}`}
                      >
                        {rule.active ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteMutation.mutate(rule.id)}
                        data-testid={`btn-delete-alert-${rule.id}`}
                      >✕</button>
                    </div>
                  </div>

                  <div className="alert-criteria" style={{ marginBottom: "10px" }}>
                    {types.length > 0 && <span className="criteria-chip">Types: {types.join(", ")}</span>}
                    {states.length > 0 && <span className="criteria-chip">States: {states.join(", ")}</span>}
                    {rule.waferSize && <span className="criteria-chip">Wafer: {rule.waferSize}</span>}
                    {rule.minSqft && <span className="criteria-chip">Min SF: {rule.minSqft.toLocaleString()}</span>}
                    {rule.maxSqft && <span className="criteria-chip">Max SF: {rule.maxSqft.toLocaleString()}</span>}
                    {rule.minPowerMW && <span className="criteria-chip">Min Power: {rule.minPowerMW}MW</span>}
                    {types.length === 0 && states.length === 0 && !rule.waferSize && !rule.minSqft && !rule.minPowerMW && (
                      <span className="criteria-chip">Match All</span>
                    )}
                  </div>

                  {/* Current matches */}
                  <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: "10px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "8px" }}>
                      Current Matches — {matches.length} listing{matches.length !== 1 ? "s" : ""}
                    </div>
                    {matches.length === 0 ? (
                      <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))" }}>No current listings match these criteria</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {matches.map((l) => {
                          const wafers = JSON.parse(l.waferSizes || "[]") as string[];
                          return (
                            <div key={l.id} style={{
                              background: "hsl(var(--secondary))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "6px",
                              padding: "8px 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                            }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{l.name}</div>
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
                                  {l.city}, {l.state} · {l.type} · {formatSqft(l.squareFootage) || "—"} · {l.powerCapacityMW ? l.powerCapacityMW + "MW" : "—"}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                {wafers.map((w) => <span key={w} className="wafer-chip">{w}</span>)}
                                <span className={`badge badge-${l.status}`} style={{ fontSize: "9px" }}>{l.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tracking instructions */}
        <div className="section-divider">Monitored Sources</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          {[
            { name: "ATREG", url: "https://atreg.com/newsletters/", note: "Q1/Q2 2026 fab disposition newsletters" },
            { name: "Moov Technologies", url: "https://site.moov.co", note: "Fab equipment & facility marketplace" },
            { name: "LoopNet / CoStar", url: "https://www.loopnet.com", note: "Commercial real estate listings" },
            { name: "LA Semiconductor", url: "https://www.lasemiconductor.com", note: "Asset disposition advisory" },
            { name: "Wolfspeed IR", url: "https://ir.wolfspeed.com", note: "Chapter 11 restructuring assets" },
            { name: "PV-Tech", url: "https://www.pv-tech.org", note: "Polysilicon & solar silicon news" },
          ].map((src) => (
            <div key={src.name} style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              padding: "12px 14px",
            }}>
              <a href={src.url} target="_blank" rel="noopener" style={{ fontWeight: 600, fontSize: "var(--text-xs)", color: "hsl(var(--primary))", textDecoration: "none", display: "block", marginBottom: "4px" }}>
                ↗ {src.name}
              </a>
              <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", lineHeight: 1.4 }}>{src.note}</div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <AddAlertModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
