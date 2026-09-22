#!/usr/bin/env bash
set -e
cd /home/rogersr/fabwatch
echo "=== FabWatch Equipment Category ==="

# 1. Add equipment table to schema.ts
if grep -q "equipment" shared/schema.ts; then
  echo "[1/5] schema already has equipment — skipping"
else
  cat >> shared/schema.ts << 'EOF'

export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  waferSize: text("wafer_size"),
  vintage: text("vintage"),
  condition: text("condition"),
  quantity: integer("quantity").notNull().default(1),
  askingPrice: text("asking_price"),
  location: text("location"),
  state: text("state"),
  seller: text("seller"),
  broker: text("broker"),
  auctionDate: text("auction_date"),
  status: text("status").notNull().default("available"),
  notes: text("notes"),
  sourceUrl: text("source_url"),
  listedDate: text("listed_date"),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;
EOF
  echo "[1/5] Updated shared/schema.ts"
fi

# 2. Create DB table and seed data via Python
python3 << 'PYEOF'
import sqlite3, json

conn = sqlite3.connect("data.db")
cur = conn.cursor()

cur.execute("""
  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, category TEXT NOT NULL,
    manufacturer TEXT, model TEXT, wafer_size TEXT,
    vintage TEXT, condition TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    asking_price TEXT, location TEXT, state TEXT,
    seller TEXT, broker TEXT, auction_date TEXT,
    status TEXT NOT NULL DEFAULT 'available',
    notes TEXT, source_url TEXT, listed_date TEXT
  )
""")
conn.commit()

cur.execute("SELECT COUNT(*) FROM equipment")
if cur.fetchone()[0] > 0:
    print("Already seeded — skipping")
else:
    seed = [
        ("ASML PAS 5500/60 i-line Stepper","litho","ASML","PAS 5500/60","200mm","2001-2005","good",1,"Contact for price","Pocatello, ID","ID","LA Semiconductor / FTI","Heritage Global",None,"watch","Former LA Semiconductor. Part of Pocatello fab equipment liquidation. i-line 365nm.","https://www.hgpauction.com","2026-09"),
        ("Lam Research 2300 Exelan Dielectric Etch","etch","Lam Research","2300 Exelan","200mm","2003-2008","good",2,"Contact for price","Various","US","Various","Moov Technologies",None,"available","200mm dielectric etch. Key tool for oxide/nitride patterning in analog/BCD flows.","https://moov.co","2026-09"),
        ("Applied Materials Centura DXZ CVD","cvd","Applied Materials","Centura DXZ","200mm","2000-2006","good",1,"~$180,000","Texas","TX","Wolfspeed","Heritage Global",None,"available","From Wolfspeed Farmers Branch disposition. SACVD oxide deposition.","https://www.hgpauction.com","2026-09"),
        ("KLA-Tencor Surfscan SP1 Wafer Inspection","metrology","KLA","Surfscan SP1","200mm","1999-2004","fair",1,"~$45,000","Various","US","Various","EquipNet",None,"available","Unpatterned wafer inspection. Essential for incoming wafer QC.","https://www.equipnet.com","2026-09"),
        ("Novellus Concept One PECVD","cvd","Novellus","Concept One","200mm","1998-2004","fair",3,"~$35,000-55,000","Various","US","Various","Moov / EquipNet",None,"available","PECVD oxide/nitride. Large installed base — parts readily available.","https://moov.co","2026-09"),
        ("Mattson Thermopro RTP System","thermal","Mattson","Thermopro","200mm","2000-2006","good",1,"~$65,000","Various","US","Various","EquipNet",None,"available","Rapid thermal processing for anneal, oxidation, silicide formation.","https://www.equipnet.com","2026-09"),
        ("FSI Polaris Spray Acid Tool","wet_clean","FSI","Polaris","200mm","1998-2006","fair",2,"~$20,000-40,000","Various","US","Various","Moov Technologies",None,"available","Wet bench / spray acid for cleans. Essential for any 200mm fab startup.","https://moov.co","2026-09"),
        ("Varian 350D Ion Implanter","implant","Varian","350D","200mm","1997-2004","good",1,"~$250,000","Various","US","Various","Heritage Global / EquipNet",None,"watch","Medium current ion implanter. Key for BCD source/drain and well implants.","https://www.hgpauction.com","2026-09"),
        ("Applied Materials Mirra Mesa CMP","cmp","Applied Materials","Mirra Mesa","200mm","2001-2007","good",1,"~$120,000","Various","US","Various","Moov / EquipNet",None,"available","200mm CMP for STI, ILD, and metal planarization.","https://moov.co","2026-09"),
        ("Therma-Wave OP2600 Optical Profilometer","metrology","Therma-Wave","OP2600","200mm","2000-2006","good",1,"~$30,000","Various","US","Various","EquipNet",None,"available","Film thickness and optical CD measurement. Inline metrology for oxide/nitride control.","https://www.equipnet.com","2026-09"),
    ]
    cur.executemany("""
        INSERT INTO equipment (name,category,manufacturer,model,wafer_size,vintage,condition,quantity,asking_price,location,state,seller,broker,auction_date,status,notes,source_url,listed_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, seed)
    conn.commit()
    print(f"Seeded {len(seed)} equipment items")

conn.close()
PYEOF
echo "[2/5] Equipment table created and seeded"

# 3. Add storage methods
if grep -q "getAllEquipment" server/storage.ts; then
  echo "[3/5] storage already has equipment methods — skipping"
else
  sed -i '/seedIfEmpty(): void {/i\
  getAllEquipment(): any[] { return (db as any).select().from((equipment as any)).all(); }\
  getEquipment(id: number): any { return (db as any).select().from((equipment as any)).where((eq as any)((equipment as any).id, id)).get(); }\
  createEquipment(data: any): any { return (db as any).insert((equipment as any)).values(data).returning().get(); }\
  deleteEquipment(id: number): void { (db as any).delete((equipment as any)).where((eq as any)((equipment as any).id, id)).run(); }\
' server/storage.ts
  echo "[3/5] Added equipment methods to storage.ts"
fi

# 4. Add API routes
if grep -q "/api/equipment" server/routes.ts; then
  echo "[4/5] routes already has equipment — skipping"
else
  sed -i '/\/\/ --- SCHEDULER ---/i\
  \/\/ --- EQUIPMENT ---\
  app.get("\/api\/equipment", requireTier("monitor"), (_req, res) => {\
    try { res.json(storage.getAllEquipment()); } catch (e) { res.status(500).json({ error: String(e) }); }\
  });\
  app.post("\/api\/equipment", (req, res) => {\
    try { res.status(201).json(storage.createEquipment(req.body)); } catch (e) { res.status(400).json({ error: String(e) }); }\
  });\
  app.delete("\/api\/equipment\/:id", (req, res) => {\
    storage.deleteEquipment(parseInt(req.params.id)); res.json({ ok: true });\
  });\
' server/routes.ts
  echo "[4/5] Added equipment routes"
fi

# 5. Write Equipment page
mkdir -p client/src/pages
cat > client/src/pages/Equipment.tsx << 'PAGEEOF'
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
PAGEEOF
echo "[5/5] Written client/src/pages/Equipment.tsx"

echo ""
echo "=== Done. Now do these three things: ==="
echo ""
echo "1. Add to client/src/App.tsx:"
echo "   import EquipmentPage from '@/pages/Equipment';"
echo "   <Route path='/equipment' component={EquipmentPage} />"
echo ""
echo "2. Add to navItems in client/src/components/Sidebar.tsx:"
echo "   { path: '/equipment', label: 'Equipment', icon: '⚙' },"
echo ""
echo "3. Rebuild:"
echo "   npm run build && pm2 restart fabwatch --update-env"
