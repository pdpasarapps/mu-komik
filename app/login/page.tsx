"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setSignedInEmail(data.user?.email ?? null);
    });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || "Reader" } },
        });

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup") {
      setMessage("Akun dibuat. Cek email kamu untuk konfirmasi sebelum login.");
      setMode("login");
      setPassword("");
    } else {
      setSignedInEmail(result.data.user?.email ?? email);
      setMessage("Login berhasil.");
      router.push("/account");
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setSignedInEmail(null);
    setMessage("Kamu sudah logout.");
  };

  return (
    <main className="auth-shell">
      <a className="auth-back" href="/"><ArrowLeft size={16} /> Back to discovery</a>
      <section className="auth-layout">
        <div className="auth-intro">
          <a className="wordmark" href="/"><span className="wordmark-dot" />mu<span>komik</span></a>
          <p className="eyebrow"><span /> Your shelf, your pace</p>
          <h1>Keep the stories<br /><em>close.</em></h1>
          <p>Sign in to keep your reading history, bookmarks, and preferences with you wherever you read.</p>
        </div>
        <div className="auth-card">
          <div className="auth-card-top"><div className="auth-icon"><UserRound size={20} /></div><span>{signedInEmail ? "Account" : mode === "login" ? "Welcome back" : "New reader"}</span></div>
          {signedInEmail ? (
            <div className="signed-in-state"><CheckCircle2 size={32} /><h2>You are signed in.</h2><p>{signedInEmail}</p><button className="button button-dark auth-submit" onClick={handleSignOut} disabled={loading}>{loading ? "Logging out..." : "Log out"}</button></div>
          ) : (
            <>
              <h2>{mode === "login" ? "Open your shelf" : "Create your account"}</h2>
              <p className="auth-subtitle">{mode === "login" ? "Pick up where you left off." : "It only takes a minute to begin."}</p>
              <form onSubmit={handleSubmit} className="auth-form">
                {mode === "signup" && <label><span>Display name</span><div className="input-wrap"><UserRound size={17} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we call you?" /></div></label>}
                <label><span>Email</span><div className="input-wrap"><Mail size={17} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div></label>
                <label><span>Password</span><div className="input-wrap"><LockKeyhole size={17} /><input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></div></label>
                {error && <p className="form-error" role="alert">{error}</p>}
                {message && <p className="form-message" role="status">{message}</p>}
                <button className="button button-dark auth-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Please wait</> : <>{mode === "login" ? "Sign in" : "Create account"} <ArrowUpRight size={17} /></>}</button>
              </form>
              <button className="mode-toggle" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
