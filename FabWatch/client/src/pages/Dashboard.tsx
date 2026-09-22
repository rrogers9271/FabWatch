import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Listing, Expansion } from "@shared/schema";

function StatCard({ label, value, sub, accentClass }: { label: string; value: string | number; sub?: string; accentClass?: string }) {
  return (
    <div className={`kpi-card ${accentClass || ""}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function formatSqft(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M sf`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k sf`;
  return `${n} sf`;
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    active: "Active",
    watch: "Watch",
    sold: "Sold",
    under_contract: "Under Contract",
  };
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    fab: "Fab",
    cleanroom: "Cleanroom",
    polysilicon: "Polysilicon",
    epitaxy: "Epitaxy",
    compound_semi: "Compound Semi",
    r_and_d: "R&D",
  };
  return <span className={`badge badge-${type}`}>{labels[type] || type}</span>;
}

function getDataQuarter(iso: string | undefined): string {
  if (!iso) return "Live Monitor";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Live Monitor";

  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${date.getUTCFullYear()}`;
}

function DashboardPage() {
  const { data: schedulerStatus } = useQuery<{
    lastRun: {
      completedAt: string;
      newListings: number;
      newExpansions: number;
      errors: number;
    } | null;
  }>({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", "/api/listings"),
  });

  const { data: expansions = [], isLoading: expLoading } = useQuery<Expansion[]>({
    queryKey: ["/api/expansions"],
    queryFn: () => apiRequest("GET", "/api/expansions"),
  });

  const active = listings.filter((l) => l.status === "active").length;
  const watch = listings.filter((l) => l.status === "watch").length;
  const polysilicon = listings.filter((l) => l.type === "polysilicon").length;
  const totalSqft = listings.reduce((s, l) => s + (l.squareFootage || 0), 0);
  const expansionInv = expansions.reduce((s, e) => s + (e.investmentBillions || 0), 0);
  const recentListings = [...listings].sort((a, b) => (b.listedDate || "").localeCompare(a.listedDate || "")).slice(0, 5);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Intelligence Overview</h1>
          <div className="page-subtitle">US Semiconductor Facility Market · {getDataQuarter(schedulerStatus?.lastRun?.completedAt)}</div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge badge-active" style={{ fontSize: "11px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(142 70% 50%)", display: "inline-block" }}></span>
            Live Data
          </span>
        </div>
      </div>

      <div className="page-content">
        {/* KPI Row */}
        <div className="kpi-grid">
          <StatCard label="Active Listings" value={active} sub="Available now" accentClass="kpi-active" />
          <StatCard label="Watch List" value={watch} sub="Monitoring disposition" accentClass="kpi-watch" />
          <StatCard label="Polysilicon / Solar-Si" value={polysilicon} sub="Sites tracked" accentClass="kpi-polysilicon" />
          <StatCard label="Total SF Tracked" value={totalSqft > 0 ? formatSqft(totalSqft) : "—"} sub="Across all listings" />
          <StatCard label="Expansion Investment" value={`$${expansionInv.toFixed(0)}B`} sub="US cluster pipeline" accentClass="kpi-expansion" />
          <StatCard label="Expansion Projects" value={expansions.length} sub="Active / planned" accentClass="kpi-expansion" />
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

          {/* Recent / Priority Listings */}
          <div>
            <div className="section-divider">Priority Listings</div>
            {listingsLoading ? (
              <div className="empty-state">Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recentListings.map((l) => {
                  const wafers = JSON.parse(l.waferSizes || "[]") as string[];
                  return (
                    <div key={l.id} className="alert-card" style={{ cursor: "default" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "var(--text-xs)", color: "hsl(var(--foreground))", lineHeight: 1.3 }}>{l.name}</div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
                            {l.city}, {l.state} · {l.broker}
                          </div>
                        </div>
                        <StatusBadge status={l.status} />
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <TypeBadge type={l.type} />
                        {wafers.map((w) => <span key={w} className="wafer-chip">{w}</span>)}
                        {l.squareFootage && <span className="criteria-chip">{formatSqft(l.squareFootage)}</span>}
                        {l.powerCapacityMW && <span className="criteria-chip">{l.powerCapacityMW}MW</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Expansion Pipeline */}
          <div>
            <div className="section-divider">Fab Cluster Expansion Pipeline</div>
            {expLoading ? (
              <div className="empty-state">Loading...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {expansions.slice(0, 5).map((e) => (
                  <div key={e.id} className="alert-card">
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-xs)", lineHeight: 1.3 }}>{e.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>
                          {e.company} · {e.city}, {e.state}
                        </div>
                      </div>
                      <span className={`badge badge-${e.status}`}>{e.status.replace(/_/g, " ")}</span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span className={`badge badge-${e.type}`}>{e.type.replace(/_/g, " ")}</span>
                      {e.investmentBillions && <span className="criteria-chip">${e.investmentBillions}B</span>}
                      {e.waferSize && <span className="wafer-chip">{e.waferSize}</span>}
                      {e.completionYear && <span className="criteria-chip">Est. {e.completionYear}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* State Distribution */}
        <div>
          <div className="section-divider">Geographic Distribution — Active Listings</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Object.entries(
              listings.reduce((acc: Record<string, number>, l) => {
                acc[l.state] = (acc[l.state] || 0) + 1;
                return acc;
              }, {})
            )
              .sort(([, a], [, b]) => b - a)
              .map(([state, count]) => (
                <div key={state} style={{
                  background: "hsl(var(--secondary))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  padding: "10px 14px",
                  textAlign: "center",
                  minWidth: "64px",
                }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "18px", fontWeight: 700, color: "hsl(var(--primary))" }}>{count}</div>
                  <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", fontWeight: 600, letterSpacing: "0.06em" }}>{state}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default DashboardPage;
