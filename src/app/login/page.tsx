"use client";
import Header from "../../components/Header";
import styles from "./Login.module.css";
import Navigation from "../../components/Navigation";
import { useState, useCallback } from "react";

import { useSupabaseClient } from "@supabase/auth-helpers-react";

import GoogleLogo from "../../data/Google.png";
import AppleLogo from "../../data/Apple.svg";
import useDocumentTitle from "../../hooks/useDocumentTitle";


export default function Login() {
  useDocumentTitle("Login | Liftspump");
  const supabase = useSupabaseClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = typeof window !== "undefined" ? (() => {
    const sp = new URLSearchParams(window.location.search);
    const next = sp.get('next');
    if (next && next.startsWith('/')) return `${window.location.origin}${next}`;
    return `${window.location.origin}/`;
  })() : undefined;

  const handleEmailPasswordAuth = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isSignUp) {
        // Basic password checks
        if (password.length < 8) {
          setMessage("Password must be at least 8 characters.");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setMessage("Passwords do not match.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo }
        });
        if (error) throw error;
        setMessage("Account created. Check your email to confirm before signing in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Successful sign in — navigate to redirectTo (honors ?next=)
        if (typeof window !== "undefined" && redirectTo) {
          window.location.href = redirectTo;
        }
      }
    } catch (err: any) {
      setMessage(err?.message || (isSignUp ? "Failed to sign up." : "Failed to sign in."));
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, isSignUp, supabase, redirectTo]);

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
      <div className={styles.pageContent} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ width: "100%", maxWidth: 460, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <h1>Login</h1>
          <p style={{ color: "white", textAlign: 'center' }}>Sign in or create an account to access your dashboard.</p>

          <form onSubmit={handleEmailPasswordAuth} style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
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

            <label htmlFor="password" style={{ color: 'white' }}>Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "Create a password" : "Your password"}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }}
            />
            {isSignUp && (
              <>
                <label htmlFor="confirmPassword" style={{ color: 'white' }}>Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }}
                />
              </>
            )}

            <button type="submit" disabled={loading} style={{ padding: 12, borderRadius: 6, border: '1px solid #333', background: '#2a2a2a', color: '#fff', cursor: 'pointer' }}>
              {loading ? (isSignUp ? 'Creating…' : 'Signing in…') : (isSignUp ? 'Create account' : 'Sign in')}
            </button>

            <button
              type="button"
              onClick={() => setIsSignUp((v) => !v)}
              style={{
                background: 'transparent',
                color: '#aaa',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                marginTop: 4,
                alignSelf: 'flex-start'
              }}
            >
              {isSignUp ? 'Have an account? Sign in' : "Need an account? Sign up"}
            </button>
          </form>

          <div style={{ width: "100%", maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ height: 1, background: '#333', flex: 1 }} />
            <span style={{ color: '#aaa' }}>or</span>
            <div style={{ height: 1, background: '#333', flex: 1 }} />
          </div>

          <div style={{ width: "100%", maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => signInWithProvider('google')} disabled={loading} style={{ padding: 12, borderRadius: 6, border: '1px solid #333', background: '#2a2a2a', color: '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <img src={GoogleLogo.src} alt="Google" style={{ height: 18 }} />
                <span>Continue with Google</span>
              </div>
            </button>
            <button onClick={() => signInWithProvider('apple')} disabled={loading} style={{ padding: 12, borderRadius: 6, border: '1px solid #333', background: '#2a2a2a', color: '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <img src={AppleLogo.src} alt="Apple" style={{ height: 18 }} />
                <span>Continue with Apple</span>
              </div>
            </button>
          </div>

          {message && (
            <p style={{ color: isSignUp && (message.includes('match') || message.includes('least')) ? '#fca5a5' : '#9ae6b4' }}>{message}</p>
          )}
        </div>
      </div>
      <footer className={styles.footer}></footer>
    </div>
  );
}
