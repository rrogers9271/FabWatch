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
