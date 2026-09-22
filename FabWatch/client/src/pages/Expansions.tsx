import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Expansion, InsertExpansion } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

function formatBillions(n: number | null) {
  if (!n) return "—";
  return `$${n}B`;
}

const STATE_CLUSTERS: Record<string, string> = {
  AZ: "Phoenix Metro Cluster",
  TX: "Texas Triangle",
  ID: "Boise / Snake River",
  NY: "Capital Region",
  OR: "Portland / Hillsboro",
  CA: "Silicon Valley / Sacramento",
  NC: "Research Triangle",
};

function AddExpansionModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertExpansion>>({ status: "planned", type: "logic" });

  const mutation = useMutation({
    mutationFn: (data: InsertExpansion) => apiRequest("POST", "/api/expansions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expansions"] });
      toast({ title: "Expansion added" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to add expansion", variant: "destructive" }),
  });

  const set = (k: keyof InsertExpansion, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.company || !form.state || !form.city || !form.type) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    mutation.mutate({
      name: form.name!,
      company: form.company!,
      state: form.state!,
      city: form.city!,
      type: form.type!,
      status: form.status || "planned",
      lat: form.lat || null,
      lng: form.lng || null,
      investmentBillions: form.investmentBillions || null,
      waferSize: form.waferSize || null,
      completionYear: form.completionYear || null,
      notes: form.notes || null,
      sourceUrl: form.sourceUrl || null,
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title">Track New Expansion</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" placeholder="e.g. TSMC Fab 3 – Phoenix" value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company *</label>
              <input className="form-input" placeholder="e.g. TSMC" value={form.company || ""} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input" value={form.type || "logic"} onChange={(e) => set("type", e.target.value)}>
                <option value="logic">Logic / CMOS</option>
                <option value="sic">SiC Power</option>
                <option value="memory">Memory (DRAM/NAND)</option>
                <option value="compound_semi">Compound Semi</option>
                <option value="advanced_packaging">Advanced Packaging</option>
                <option value="polysilicon">Polysilicon</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City *</label>
              <input className="form-input" value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State *</label>
              <input className="form-input" maxLength={2} placeholder="AZ" value={form.state || ""} onChange={(e) => set("state", e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Investment ($B)</label>
              <input className="form-input" type="number" step="0.1" value={form.investmentBillions || ""} onChange={(e) => set("investmentBillions", parseFloat(e.target.value) || null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status || "planned"} onChange={(e) => set("status", e.target.value)}>
                <option value="planned">Planned</option>
                <option value="under_construction">Under Construction</option>
                <option value="operational">Operational</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Wafer Size</label>
              <input className="form-input" placeholder="e.g. 300mm" value={form.waferSize || ""} onChange={(e) => set("waferSize", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Completion Year</label>
              <input className="form-input" type="number" placeholder="2027" value={form.completionYear || ""} onChange={(e) => set("completionYear", parseInt(e.target.value) || null)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Source URL</label>
            <input className="form-input" placeholder="https://" value={form.sourceUrl || ""} onChange={(e) => set("sourceUrl", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} style={{ resize: "vertical" }} />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpansionsPage() {
  const { data: expansions = [], isLoading } = useQuery<Expansion[]>({
    queryKey: ["/api/expansions"],
    queryFn: () => apiRequest("GET", "/api/expansions"),
  });

  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [stateFilter, setStateFilter] = useState("all");

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/expansions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expansions"] });
      toast({ title: "Expansion removed" });
    },
  });

  const filtered = stateFilter === "all" ? expansions : expansions.filter((e) => e.state === stateFilter);
  const states = [...new Set(expansions.map((e) => e.state))].sort();
  const totalInvestment = expansions.reduce((s, e) => s + (e.investmentBillions || 0), 0);

  // Group by state cluster
  const byState = filtered.reduce((acc: Record<string, Expansion[]>, e) => {
    const key = e.state;
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cluster Expansions</h1>
          <div className="page-subtitle">
            {expansions.length} projects · ${totalInvestment.toFixed(0)}B total pipeline investment
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Track Project</button>
      </div>

      <div className="filter-bar">
        <select className="filter-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="all">All States</option>
          {states.map((s) => <option key={s} value={s}>{s} — {STATE_CLUSTERS[s] || s}</option>)}
        </select>
      </div>

      <div style={{ padding: "20px 28px" }}>
        {/* Investment by State summary */}
        <div style={{ marginBottom: "24px" }}>
          <div className="section-divider">Investment Pipeline by State</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {Object.entries(
              expansions.reduce((acc: Record<string, number>, e) => {
                acc[e.state] = (acc[e.state] || 0) + (e.investmentBillions || 0);
                return acc;
              }, {})
            ).sort(([, a], [, b]) => b - a).map(([state, inv]) => (
              <div key={state} style={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                padding: "12px 16px",
                minWidth: "120px",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 700, color: "hsl(38 90% 60%)" }}>${inv.toFixed(0)}B</div>
                <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", fontWeight: 600, letterSpacing: "0.06em" }}>{state}</div>
                <div style={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>{STATE_CLUSTERS[state] || ""}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grouped by state */}
        {Object.entries(byState).map(([state, exps]) => (
          <div key={state} style={{ marginBottom: "28px" }}>
            <div className="section-divider">{state} — {STATE_CLUSTERS[state] || "Regional Cluster"}</div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Investment</th>
                    <th>Wafer Size</th>
                    <th>Est. Completion</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {exps.map((e) => (
                    <tr key={e.id} data-testid={`row-expansion-${e.id}`}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-xs)" }}>{e.name}</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "2px" }}>{e.city}, {e.state}</div>
                      </td>
                      <td className="td-mono" style={{ color: "hsl(var(--foreground))" }}>{e.company}</td>
                      <td><span className={`badge badge-${e.type}`}>{e.type.replace(/_/g, " ")}</span></td>
                      <td><span className={`badge badge-${e.status}`}>{e.status.replace(/_/g, " ")}</span></td>
                      <td className="td-mono" style={{ color: "hsl(38 90% 60%)" }}>{formatBillions(e.investmentBillions)}</td>
                      <td>{e.waferSize ? <span className="wafer-chip">{e.waferSize}</span> : <span className="td-mono">—</span>}</td>
                      <td className="td-mono">{e.completionYear || "—"}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteMutation.mutate(e.id)}
                          data-testid={`btn-delete-expansion-${e.id}`}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {showAdd && <AddExpansionModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
