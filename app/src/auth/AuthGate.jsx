import { useEffect, useState } from "react";
import { authConfigured, supabase } from "./supabaseClient";
import "./AuthGate.css";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
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
    if (!supabase) return;
    setBusy(true);
    setMessage("");
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

  if (!authConfigured) {
    return (
      <div className="pf-auth-preview-banner">
        <div><strong>Local Preview</strong><span>Real login is ready; add Supabase keys on Render to turn it on.</span></div>
        {children}
      </div>
    );
  }

  if (!session) {
    return (
      <main className="pf-auth-screen">
        <div className="pf-auth-aurora pf-auth-aurora-a" />
        <div className="pf-auth-aurora pf-auth-aurora-b" />
        <section className="pf-auth-card">
          <div className="pf-auth-brand"><span>PF</span><div><strong>PhongFlow</strong><small>Real Estate Visual Studio</small></div></div>
          <div className="pf-auth-copy"><span>PRIVATE WORKSPACE</span><h1>Welcome back.</h1><p>One project. One masterplan. Every unit connected.</p></div>
          <form onSubmit={submit}>
            <label><span>Email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label><span>Password</span><input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required /></label>
            <button type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          {message && <p className="pf-auth-message">{message}</p>}
          <button className="pf-auth-switch" type="button" onClick={() => { setMode((value) => value === "signin" ? "signup" : "signin"); setMessage(""); }}>
            {mode === "signin" ? "Need an internal account? Create one" : "Already have an account? Sign in"}
          </button>
          <small className="pf-auth-foot">Private beta · PhongFlow workspace</small>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
