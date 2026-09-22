import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

const CATEGORY_LABELS: Record<string, string> = {
  litho:"Lithography", etch:"Etch", cvd:"CVD / Deposition",
  pvd:"PVD / Sputtering", implant:"Ion Implant", cmp:"CMP",
  metrology:"Metrology / Inspection", wet_clean:"Wet Clean",
  thermal:"Thermal / Diffusion", test:"Test & Characterization", other:"Other",
};
const CONDITION_COLOR: Record<string, string> = {
  excellent:"hsl(142 60% 45%)", good:"hsl(197 100% 40%)",
  fair:"hsl(45 100% 50%)", unknown:"hsl(210 12% 45%)", for_parts:"hsl(0 70% 55%)",
};
const STATUS_COLOR: Record<string, string> = {
  available:"hsl(142 60% 45%)", pending:"hsl(45 100% 50%)",
  sold:"hsl(0 70% 55%)", watch:"hsl(210 12% 45%)",
};

type EquipmentItem = {
  id:number; name:string; category:string; manufacturer:string|null;
  model:string|null; waferSize:string|null; vintage:string|null;
  condition:string|null; quantity:number; askingPrice:string|null;
  location:string|null; state:string|null; seller:string|null;
  broker:string|null; auctionDate:string|null; status:string;
  notes:string|null; sourceUrl:string|null; listedDate:string|null;
};

export default function EquipmentPage() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading, error } = useQuery<EquipmentItem[]>({
    queryKey: ["/api/equipment"],
  });

  if (error) {
    return (
      <div style={{ padding:"40px 32px" }}>
        <div style={{ fontSize:"13px", color:"hsl(var(--muted-foreground))", padding:"20px", border:"1px solid hsl(var(--border))", borderRadius:"9px" }}>
          Equipment intelligence requires a Monitor subscription.{" "}
          <a href="/#/pricing" style={{ color:"hsl(197 100% 40%)" }}>Upgrade →</a>
        </div>
      </div>
    );
  }

  const filtered = items.filter(item => {
    const matchCat = filter === "all" || item.category === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || [item.name,item.manufacturer,item.model,item.location,item.seller]
      .some(f => f?.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  return (
    <div style={{ padding:"24px 32px" }}>
      <div style={{ marginBottom:"24px", display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <h1 style={{ fontSize:"20px", fontWeight:600, color:"hsl(var(--foreground))", marginBottom:"4px" }}>Equipment Intelligence</h1>
          <p style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))" }}>Used 200mm semiconductor equipment — auctions, liquidations, and direct sales</p>
        </div>
        <div style={{ fontSize:"11px", fontFamily:"var(--font-mono)", color:"hsl(197 100% 40%)", background:"hsl(197 100% 40% / 0.1)", border:"1px solid hsl(197 100% 40% / 0.3)", borderRadius:"6px", padding:"6px 12px" }}>
          {filtered.length} items
        </div>
      </div>

      <div style={{ display:"flex", gap:"8px", marginBottom:"20px", flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search equipment, manufacturer, location…"
          style={{ padding:"6px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"12px", width:"240px" }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding:"6px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"12px" }}>
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", padding:"40px 0", textAlign:"center" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", padding:"40px 0", textAlign:"center" }}>No equipment found matching filters.</div>
      ) : (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ borderBottom:"1px solid hsl(var(--border))" }}>
                {["Equipment","Category","Wafer","Condition","Price","Location","Broker","Status"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"8px 12px", color:"hsl(var(--muted-foreground))", fontWeight:500, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ borderBottom:"1px solid hsl(var(--border))", background: i%2===0 ? "transparent" : "hsl(var(--muted) / 0.3)" }}>
                  <td style={{ padding:"10px 12px", maxWidth:"260px" }}>
                    <div style={{ fontWeight:500, color:"hsl(var(--foreground))", marginBottom:"2px" }}>
                      {item.sourceUrl
                        ? <a href={item.sourceUrl} target="_blank" rel="noopener" style={{ color:"hsl(var(--foreground))", textDecoration:"none" }}>{item.name}</a>
                        : item.name}
                    </div>
                    {item.manufacturer && <div style={{ fontSize:"11px", color:"hsl(var(--muted-foreground))" }}>{item.manufacturer}{item.model ? ` · ${item.model}` : ""}</div>}
                    {item.quantity > 1 && <div style={{ fontSize:"10px", color:"hsl(197 100% 40%)" }}>Qty: {item.quantity}</div>}
                    {item.notes && <div style={{ fontSize:"10px", color:"hsl(210 12% 38%)", marginTop:"3px", lineHeight:1.4 }}>{item.notes.slice(0,100)}{item.notes.length>100?"…":""}</div>}
                  </td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap", color:"hsl(var(--muted-foreground))" }}>{CATEGORY_LABELS[item.category] ?? item.category}</td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap", fontFamily:"var(--font-mono)", fontSize:"11px" }}>{item.waferSize ?? "—"}</td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>
                    <span style={{ color:CONDITION_COLOR[item.condition ?? "unknown"] ?? "hsl(var(--muted-foreground))", fontSize:"11px", fontFamily:"var(--font-mono)" }}>
                      {item.condition ?? "unknown"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap", fontFamily:"var(--font-mono)", fontSize:"11px", color:"hsl(var(--foreground))" }}>{item.askingPrice ?? "—"}</td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap", color:"hsl(var(--muted-foreground))" }}>{item.location ?? "—"}</td>
                  <td style={{ padding:"10px 12px", whiteSpace:"nowrap", color:"hsl(var(--muted-foreground))" }}>{item.broker ?? item.seller ?? "—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ color:STATUS_COLOR[item.status] ?? "hsl(var(--muted-foreground))", fontSize:"10px", fontFamily:"var(--font-mono)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
