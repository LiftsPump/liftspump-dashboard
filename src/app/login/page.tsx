"use client";
import Header from "../../components/Header";
import styles from "../page.module.css";
import Navigation from "../../components/Navigation";
import { useMemo, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";


export default function Login() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    if (!url || !anon) {
      console.warn("Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    return createClient(url || "", anon || "");
  }, []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  const signInWithEmail = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
      setMessage("Magic link sent. Check your email.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  }, [email, supabase, redirectTo]);

  const signInWithProvider = useCallback(async (provider: 'google' | 'apple') => {
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (error) throw error;
      // Redirect will happen; no further action needed here.
    } catch (err: any) {
      setMessage(err?.message || `Failed to sign in with ${provider}.`);
      setLoading(false);
    }
  }, [supabase, redirectTo]);

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.pageContent} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16 }}>
        <h1>Login</h1>
        <p style={{ color: "white", textAlign: 'center' }}>Sign in or create an account to access your dashboard.</p>

        <form onSubmit={signInWithEmail} style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
          <label htmlFor="email" style={{ color: 'white' }}>Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }}
          />
          <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 8, border: 'none', cursor: 'pointer' }}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        <div style={{ width: "100%", maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ height: 1, background: '#333', flex: 1 }} />
          <span style={{ color: '#aaa' }}>or</span>
          <div style={{ height: 1, background: '#333', flex: 1 }} />
        </div>

        <div style={{ width: "100%", maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => signInWithProvider('google')} disabled={loading} style={{ padding: 12, borderRadius: 8, border: '1px solid #444', background: '#0b0b0b', color: '#fff', cursor: 'pointer' }}>
            Continue with Google
          </button>
          <button onClick={() => signInWithProvider('apple')} disabled={loading} style={{ padding: 12, borderRadius: 8, border: '1px solid #444', background: '#0b0b0b', color: '#fff', cursor: 'pointer' }}>
            Continue with Apple
          </button>
        </div>

        {message && <p style={{ color: '#9ae6b4' }}>{message}</p>}
      </div>
      <footer className={styles.footer}></footer>
    </div>
  );
}
