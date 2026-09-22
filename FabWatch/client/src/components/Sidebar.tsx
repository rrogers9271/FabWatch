import { useHashLocation } from "wouter/use-hash-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const navItems = [
  { path: "/", label: "Overview", icon: "⬡" },
  { path: "/listings", label: "Active Listings", icon: "≡" },
  { path: "/map", label: "Facility Map", icon: "◎" },
  { path: "/expansions", label: "Cluster Expansions", icon: "◈" },
  { path: "/equipment", label: "Equipment", icon: "⚙" },
  { path: "/alerts", label: "Alert Criteria", icon: "◑" },
];

interface SchedulerStatus {
  lastRun: { completedAt: string; newListings: number; newExpansions: number; errors: number } | null;
  intervalHours: number;
  nextRunEstimate: string | null;
  sourcesCount: number;
}
interface AuthUser { id: number; email: string; tier: string; }

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TIER_COLOR: Record<string, string> = {
  free: "hsl(210 12% 38%)",
  monitor: "hsl(197 100% 40%)",
  pro: "hsl(45 100% 50%)",
};

export default function Sidebar() {
  const [location, navigate] = useHashLocation();
  const queryClient = useQueryClient();

  const { data: schedulerStatus } = useQuery<SchedulerStatus>({
    queryKey: ["/api/scheduler/status"],
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: authData, isLoading, error } = useQuery<{ user: AuthUser }>({
  queryKey: ["/api/auth/me"],
  retry: false,
  staleTime: 5 * 60_000,
});

console.log("[Sidebar auth]", {
  authData,
  user: authData?.user,
  isLoading,
  error,
});


  const user = authData?.user;
  const tier = user?.tier ?? "free";
  const lastUpdated = schedulerStatus?.lastRun?.completedAt;

  const handleTriggerUpdate = async () => {
    await fetch("/api/scheduler/trigger", { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["/api/scheduler/status"] });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    navigate("/login");
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-logo">
        <svg aria-label="FabWatch" width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="4" fill="hsl(215 28% 11%)"/>
          <rect x="7" y="7" width="18" height="18" rx="2" stroke="hsl(197 100% 40%)" strokeWidth="1.5"/>
          <rect x="11" y="11" width="10" height="10" rx="1" fill="hsl(197 100% 40%)" opacity="0.2" stroke="hsl(197 100% 40%)" strokeWidth="1"/>
          <line x1="16" y1="3" x2="16" y2="7" stroke="hsl(197 100% 40%)" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="25" x2="16" y2="29" stroke="hsl(197 100% 40%)" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="3" y1="16" x2="7" y2="16" stroke="hsl(197 100% 40%)" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="25" y1="16" x2="29" y2="16" stroke="hsl(197 100% 40%)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="16" cy="16" r="2" fill="hsl(197 100% 40%)"/>
        </svg>
        <div>
          <div className="sidebar-logo-text">FabWatch</div>
          <div className="sidebar-logo-sub">US Semiconductor Monitor</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Intelligence</div>
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path === "/" && location === "");
          return (
            <button key={item.path}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={`nav-item${isActive ? " active" : ""}`}
              onClick={() => navigate(item.path)}>
              <span style={{ fontFamily:"monospace", fontSize:"14px", opacity:0.8 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

        <div className="nav-section-label" style={{ marginTop:"16px" }}>Sources</div>
        <a href="https://atreg.com/newsletters/" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> ATREG Newsletters
        </a>
        <a href="https://moov.co" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> Moov Technologies
        </a>
        <a href="https://www.hgpauction.com" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> Heritage Global
        </a>
        <a href="https://www.semi.org/en/blogs/press-releases" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> SEMI.org
        </a>
        <a href="https://www.semiconductors.org/category/press-releases/" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> SIA Press
        </a>
        <a href="https://www.courtlistener.com/docket/68649684/" target="_blank" rel="noopener" className="nav-item">
          <span style={{ fontSize:"10px", opacity:0.7 }}>↗</span> LA Semi Docket
        </a>
      </nav>

      <div style={{ padding:"12px 16px", borderTop:"1px solid hsl(215 20% 18%)" }}>
        {user ? (
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:"11px", color:"hsl(210 12% 45%)", fontFamily:"var(--font-mono)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"140px" }}>
                {user.email}
              </span>
              <span style={{ fontSize:"9px", fontFamily:"var(--font-mono)", fontWeight:600, padding:"1px 6px", borderRadius:"99px", border:`1px solid ${TIER_COLOR[tier]}`, color:TIER_COLOR[tier], textTransform:"uppercase", letterSpacing:"0.05em" }}>
                {tier}
              </span>
            </div>
            {tier === "free" && (
              <button onClick={() => navigate("/pricing")}
                style={{ background:"none", border:"1px solid hsl(197 100% 40%)", borderRadius:"4px", color:"hsl(197 100% 40%)", cursor:"pointer", fontSize:"10px", fontFamily:"var(--font-mono)", padding:"3px 8px", textAlign:"center" }}>
                Upgrade to Monitor ↗
              </button>
            )}
            <button onClick={handleLogout}
              style={{ background:"none", border:"none", color:"hsl(210 12% 32%)", cursor:"pointer", fontSize:"10px", fontFamily:"var(--font-mono)", padding:0, textAlign:"left" }}>
              Sign out
            </button>
          </div>
        ) : (
          <button onClick={() => navigate("/login")}
            style={{ width:"100%", background:"none", border:"1px solid hsl(215 20% 22%)", borderRadius:"4px", color:"hsl(210 12% 45%)", cursor:"pointer", fontSize:"10px", fontFamily:"var(--font-mono)", padding:"4px 8px" }}>
            Sign in / Register
          </button>
        )}
      </div>

      <div style={{ padding:"10px 16px", borderTop:"1px solid hsl(215 20% 18%)", display:"flex", flexDirection:"column", gap:"5px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:"10px", color:"hsl(210 12% 38%)", fontFamily:"var(--font-mono)" }}>
            {lastUpdated
              ? <>Updated <span style={{ color:"hsl(197 100% 55%)" }}>{formatRelative(lastUpdated)}</span></>
              : <span>awaiting first sync…</span>}
          </div>
          <button onClick={handleTriggerUpdate} title="Trigger manual update"
            style={{ background:"none", border:"1px solid hsl(215 20% 22%)", borderRadius:"3px", color:"hsl(210 12% 45%)", cursor:"pointer", fontSize:"10px", fontFamily:"var(--font-mono)", padding:"2px 6px" }}>
            ↻
          </button>
        </div>
        {schedulerStatus?.lastRun && (
          <div style={{ fontSize:"10px", fontFamily:"var(--font-mono)", color:"hsl(210 12% 38%)", display:"flex", gap:"8px" }}>
            <span style={{ color:"hsl(142 60% 45%)" }}>+{schedulerStatus.lastRun.newListings} listings</span>
            <span style={{ color:"hsl(197 80% 45%)" }}>+{schedulerStatus.lastRun.newExpansions} exp</span>
            {schedulerStatus.lastRun.errors > 0 && <span style={{ color:"hsl(0 70% 55%)" }}>{schedulerStatus.lastRun.errors} err</span>}
          </div>
        )}
        <div style={{ fontSize:"9px", color:"hsl(210 12% 28%)", fontFamily:"var(--font-mono)" }}>
          {schedulerStatus?.sourcesCount ?? 16} sources · 6h interval
        </div>
      </div>
    </aside>
  );
}
