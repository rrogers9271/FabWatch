import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
type Mode = "login" | "register";
export default function LoginPage() {
  const [, navigate] = useHashLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      const resp = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Something went wrong"); return; }
      navigate("/"); window.location.reload();
    } catch { setError("Network error"); } finally { setLoading(false); }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"hsl(var(--background))" }}>
      <div style={{ width:"360px", background:"hsl(var(--card))", border:"1px solid hsl(var(--border))", borderRadius:"9px", padding:"32px" }}>
        <div style={{ marginBottom:"24px" }}>
          <div style={{ fontSize:"11px", fontFamily:"var(--font-mono)", color:"hsl(197 100% 40%)", marginBottom:"6px" }}>FABWATCH</div>
          <h1 style={{ fontSize:"18px", fontWeight:600, color:"hsl(var(--foreground))" }}>{mode === "login" ? "Sign in" : "Create account"}</h1>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <div>
            <label style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", display:"block", marginBottom:"4px" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder="you@company.com"
              style={{ width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"13px", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:"12px", color:"hsl(var(--muted-foreground))", display:"block", marginBottom:"4px" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} placeholder={mode === "register" ? "Min. 8 characters" : ""}
              style={{ width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid hsl(var(--border))", background:"hsl(var(--background))", color:"hsl(var(--foreground))", fontSize:"13px", boxSizing:"border-box" }} />
          </div>
          {error && <div style={{ fontSize:"12px", color:"hsl(0 70% 55%)", padding:"8px 10px", background:"hsl(0 70% 10%)", borderRadius:"4px" }}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading || !email || !password}
            style={{ padding:"9px", borderRadius:"6px", background:"hsl(197 100% 40%)", color:"#000", fontWeight:600, fontSize:"13px", border:"none", cursor:"pointer", opacity:loading ? 0.7 : 1 }}>
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
          <div style={{ fontSize:"12px", textAlign:"center", color:"hsl(var(--muted-foreground))" }}>
            {mode === "login" ? "No account? " : "Already registered? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ background:"none", border:"none", color:"hsl(197 100% 40%)", cursor:"pointer", fontSize:"12px", padding:0 }}>
              {mode === "login" ? "Create one free" : "Sign in"}
            </button>
          </div>
          {mode === "register" && <p style={{ fontSize:"10px", color:"hsl(var(--muted-foreground))", lineHeight:1.5, textAlign:"center" }}>By registering you confirm you are a US person or entity and agree to use this data for lawful purposes only.</p>}
        </div>
      </div>
    </div>
  );
}
