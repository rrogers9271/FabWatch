import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Listing, InsertListing } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

function formatSqft(n: number | null) {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M sf`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k sf`;
  return `${n} sf`;
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { active: "Active", watch: "Watch", sold: "Sold", under_contract: "Under Contract" };
  return <span className={`badge badge-${status}`}>{labels[status] || status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = { fab: "Fab", cleanroom: "Cleanroom", polysilicon: "Polysilicon", epitaxy: "Epitaxy", compound_semi: "Compound Semi", r_and_d: "R&D" };
  return <span className={`badge badge-${type}`}>{labels[type] || type}</span>;
}

function ListingDetail({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const wafers = JSON.parse(listing.waferSizes || "[]") as string[];
  const nodes = JSON.parse(listing.nodes || "[]") as string[];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title" style={{ fontSize: "var(--text-base)" }}>{listing.name}</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} data-testid="close-detail">✕</button>
        </div>
        <div className="dialog-body">
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            <StatusBadge status={listing.status} />
            <TypeBadge type={listing.type} />
            {wafers.map((w) => <span key={w} className="wafer-chip">{w}</span>)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            {[
              ["Location", `${listing.city}, ${listing.state}`],
              ["Broker", listing.broker],
              ["Seller", listing.seller || "—"],
              ["Listed", listing.listedDate || "—"],
              ["Square Footage", formatSqft(listing.squareFootage)],
              ["Power Capacity", listing.powerCapacityMW ? `${listing.powerCapacityMW} MW` : "—"],
              ["Asking Price", listing.askingPrice || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "2px" }}>{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "hsl(var(--foreground))" }}>{val}</div>
              </div>
            ))}
          </div>

          {nodes.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "6px" }}>Process Nodes</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {nodes.map((n) => <span key={n} className="criteria-chip">{n}</span>)}
              </div>
            </div>
          )}

          {listing.notes && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "hsl(var(--muted-foreground))", marginBottom: "6px" }}>Notes</div>
              <div style={{ fontSize: "var(--text-xs)", color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>{listing.notes}</div>
            </div>
          )}

          {listing.sourceUrl && (
            <a href={listing.sourceUrl} target="_blank" rel="noopener" className="btn btn-secondary btn-sm" style={{ marginTop: "4px" }}>
              ↗ Source
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AddListingModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertListing>>({ status: "active", type: "fab", waferSizes: "[]", nodes: "[]" });

  const mutation = useMutation({
    mutationFn: (data: InsertListing) => apiRequest("POST", "/api/listings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      toast({ title: "Listing added" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Failed to add listing", variant: "destructive" }),
  });

  const set = (k: keyof InsertListing, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (!form.name || !form.broker || !form.state || !form.city || !form.type) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    mutation.mutate({
      name: form.name!,
      broker: form.broker!,
      status: form.status || "active",
      type: form.type!,
      waferSizes: form.waferSizes || "[]",
      nodes: form.nodes || "[]",
      state: form.state!,
      city: form.city!,
      squareFootage: form.squareFootage || null,
      powerCapacityMW: form.powerCapacityMW || null,
      askingPrice: form.askingPrice || null,
      seller: form.seller || null,
      listedDate: form.listedDate || null,
      notes: form.notes || null,
      sourceUrl: form.sourceUrl || null,
      lat: form.lat || null,
      lng: form.lng || null,
    });
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title">Add New Listing</div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="form-group">
            <label className="form-label">Facility Name *</label>
            <input className="form-input" placeholder="e.g. 200mm SiC Fab – Phoenix, AZ" value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="input-name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type *</label>
              <select className="form-input" value={form.type || "fab"} onChange={(e) => set("type", e.target.value)} data-testid="select-type">
                <option value="fab">Fab</option>
                <option value="cleanroom">Cleanroom</option>
                <option value="polysilicon">Polysilicon</option>
                <option value="epitaxy">Epitaxy</option>
                <option value="compound_semi">Compound Semi</option>
                <option value="r_and_d">R&D</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status *</label>
              <select className="form-input" value={form.status || "active"} onChange={(e) => set("status", e.target.value)} data-testid="select-status">
                <option value="active">Active</option>
                <option value="watch">Watch</option>
                <option value="under_contract">Under Contract</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City *</label>
              <input className="form-input" placeholder="City" value={form.city || ""} onChange={(e) => set("city", e.target.value)} data-testid="input-city" />
            </div>
            <div className="form-group">
              <label className="form-label">State *</label>
              <input className="form-input" placeholder="e.g. AZ" maxLength={2} value={form.state || ""} onChange={(e) => set("state", e.target.value.toUpperCase())} data-testid="input-state" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Broker *</label>
              <input className="form-input" placeholder="e.g. ATREG, Moov" value={form.broker || ""} onChange={(e) => set("broker", e.target.value)} data-testid="input-broker" />
            </div>
            <div className="form-group">
              <label className="form-label">Seller</label>
              <input className="form-input" placeholder="Company name" value={form.seller || ""} onChange={(e) => set("seller", e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sq Footage</label>
              <input className="form-input" type="number" placeholder="e.g. 200000" value={form.squareFootage || ""} onChange={(e) => set("squareFootage", parseInt(e.target.value) || null)} />
            </div>
            <div className="form-group">
              <label className="form-label">Power (MW)</label>
              <input className="form-input" type="number" step="0.1" placeholder="e.g. 14" value={form.powerCapacityMW || ""} onChange={(e) => set("powerCapacityMW", parseFloat(e.target.value) || null)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Wafer Sizes (JSON)</label>
              <input className="form-input" placeholder='["200mm","300mm"]' value={form.waferSizes || "[]"} onChange={(e) => set("waferSizes", e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Asking Price</label>
              <input className="form-input" placeholder="e.g. ~$45M or Undisclosed" value={form.askingPrice || ""} onChange={(e) => set("askingPrice", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Source URL</label>
            <input className="form-input" placeholder="https://" value={form.sourceUrl || ""} onChange={(e) => set("sourceUrl", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={3} placeholder="Key details, context, acquisition rationale..." value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} style={{ resize: "vertical" }} />
          </div>
        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={mutation.isPending} data-testid="btn-submit-listing">
            {mutation.isPending ? "Saving..." : "Add Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingsPage() {
  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings"],
    queryFn: () => apiRequest("GET", "/api/listings"),
  });

  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/listings"] });
      setSelected(null);
      toast({ title: "Listing removed" });
    },
  });

  const filtered = listings.filter((l) => {
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (typeFilter !== "all" && l.type !== typeFilter) return false;
    if (stateFilter !== "all" && l.state !== stateFilter) return false;
    if (search && !`${l.name} ${l.city} ${l.broker} ${l.seller}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const states = [...new Set(listings.map((l) => l.state))].sort();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Listings</h1>
          <div className="page-subtitle">{filtered.length} of {listings.length} facilities shown</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)} data-testid="btn-add-listing">+ Add Listing</button>
      </div>

      <div className="filter-bar">
        <input className="filter-input" placeholder="Search by name, city, broker..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
        <select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="filter-status">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="watch">Watch</option>
          <option value="under_contract">Under Contract</option>
          <option value="sold">Sold</option>
        </select>
        <select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-testid="filter-type">
          <option value="all">All Types</option>
          <option value="fab">Fab</option>
          <option value="cleanroom">Cleanroom</option>
          <option value="polysilicon">Polysilicon</option>
          <option value="epitaxy">Epitaxy</option>
          <option value="compound_semi">Compound Semi</option>
          <option value="r_and_d">R&D</option>
        </select>
        <select className="filter-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} data-testid="filter-state">
          <option value="all">All States</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ padding: "20px 28px" }}>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Type</th>
                <th>Status</th>
                <th>Wafer Size</th>
                <th>Sq Ft</th>
                <th>Power (MW)</th>
                <th>Asking</th>
                <th>Broker</th>
                <th>Listed</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="empty-state">Loading listings...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-state">No listings match the current filters</td></tr>
              ) : filtered.map((l) => {
                const wafers = JSON.parse(l.waferSizes || "[]") as string[];
                return (
                  <tr key={l.id} onClick={() => setSelected(l)} data-testid={`row-listing-${l.id}`}>
                    <td className="td-name">
                      <span className="facility-name">{l.name}</span>
                      <span className="facility-sub">{l.city}, {l.state} · {l.seller || ""}</span>
                    </td>
                    <td><span className={`badge badge-${l.type}`}>{l.type.replace(/_/g, " ")}</span></td>
                    <td><span className={`badge badge-${l.status}`}>{l.status.replace(/_/g, " ")}</span></td>
                    <td>
                      {wafers.length > 0
                        ? wafers.map((w) => <span key={w} className="wafer-chip">{w}</span>)
                        : <span className="td-mono">—</span>}
                    </td>
                    <td className="td-mono">{formatSqft(l.squareFootage)}</td>
                    <td className="td-mono">{l.powerCapacityMW ? `${l.powerCapacityMW}` : "—"}</td>
                    <td className="td-mono" style={{ fontSize: "10px" }}>{l.askingPrice || "—"}</td>
                    <td className="td-mono" style={{ fontSize: "10px" }}>{l.broker}</td>
                    <td className="td-mono" style={{ fontSize: "10px" }}>{l.listedDate || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <ListingDetail listing={selected} onClose={() => setSelected(null)} />}
      {showAdd && <AddListingModal onClose={() => setShowAdd(false)} />}
    </>
  );
}
