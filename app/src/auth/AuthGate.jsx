import { useEffect, useState } from "react";
import { authConfigured, supabase } from "./supabaseClient";
import "./AuthGate.css";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [previewSession, setPreviewSession] = useState(() => localStorage.getItem("phongflow-preview-auth-v1") === "1");
  const [ready, setReady] = useState(!authConfigured);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authConfigured || !supabase) return undefined;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session || null);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setReady(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    if (!authConfigured || !supabase) {
      window.setTimeout(() => {
        localStorage.setItem("phongflow-preview-auth-v1", "1");
        setPreviewSession(true);
        setBusy(false);
      }, 420);
      return;
    }

    try {
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Account created. Check your email to confirm, then sign in.");
      }
    } catch (error) {
      setMessage(error.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <div className="pf-auth-loading"><span className="pf-auth-mark">PF</span><p>Opening PhongFlow…</p></div>;
  }

  const hasAccess = authConfigured ? Boolean(session) : previewSession;

  if (!hasAccess) {
    return (
      <main className="pf-auth-screen">
        <nav className="pf-auth-topbar">
          <div className="pf-auth-topbrand"><span>PF</span><strong>PhongFlow</strong></div>
          <small>{authConfigured ? "Private workspace" : "Preview mode"}</small>
        </nav>

        <section className="pf-auth-hero">
          <div className="pf-auth-copy">
            <span>REAL ESTATE VISUAL STUDIO</span>
            <h1>One project.<br/>Every unit connected.</h1>
            <p>Move from the whole masterplan to each sales visual without losing context.</p>
          </div>

          <section className="pf-auth-card">
            <div className="pf-auth-card-head">
              <span>{mode === "signin" ? "WELCOME BACK" : "INTERNAL ACCESS"}</span>
              <h2>{mode === "signin" ? "Sign in to PhongFlow" : "Create your account"}</h2>
              <p>{authConfigured ? "Use your internal account to continue." : "Preview the complete login flow now. Real account security activates when Supabase is connected."}</p>
            </div>

            <form onSubmit={submit}>
              <label><span>Email or ID</span><input type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label><span>Password</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
              <button type="submit" disabled={busy}>{busy ? "Opening…" : authConfigured ? (mode === "signin" ? "Sign in" : "Create account") : "Enter preview"}</button>
            </form>

            {message && <p className="pf-auth-message">{message}</p>}
            <button className="pf-auth-switch" type="button" onClick={() => { setMode((value) => value === "signin" ? "signup" : "signin"); setMessage(""); }}>
              {mode === "signin" ? "Create an internal account" : "Back to sign in"}
            </button>
          </section>
        </section>

        <footer className="pf-auth-foot">Private beta · Built for real-estate sales teams</footer>
      </main>
    );
  }

  return <>{children}</>;
}
