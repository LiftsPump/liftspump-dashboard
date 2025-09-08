'use client';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import "./globals.css";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import SupabaseProvider from "../components/SupabaseProvider"

import { useSessionContext, useSupabaseClient } from "@supabase/auth-helpers-react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const theme = createTheme({
    palette: {
      mode: "dark",
      primary: { main: "#1AE080" },
      background: { default: "#0f0f10", paper: "#121316" },
      text: { primary: "#EAEAEA", secondary: "#B0B0B0" },
      divider: "#2a2a2a",
    },
    shape: { borderRadius: 10 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: "#121316",
            color: "#fff",
            border: "1px solid #2a2a2a",
            backgroundImage:
              "radial-gradient(800px 200px at -10% -20%, rgba(26,224,128,0.08), transparent)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", borderColor: "#2a2a2a" },
          containedPrimary: { color: "#0b0b0b" },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { backgroundColor: "#1f1f22", color: "#e5e7eb", borderColor: "#333" },
          outlined: { borderColor: "#333" },
        },
      },
      MuiDivider: {
        styleOverrides: { root: { borderColor: "#2a2a2a" } },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: "#2a2a2a" },
          },
        },
      },
    },
  });

  function AuthRedirect() {
    const { session, isLoading } = useSessionContext();
    const supabase = useSupabaseClient();
    const pathname = usePathname();
    useEffect(() => {
      if (isLoading) return; // wait until session is resolved
      const onLogin = pathname === "/login";
      const isPublic = pathname === "/join"; // allow public invite page
      if (!session?.user && !onLogin && !isPublic) router.push("/login");
      if (session?.user && onLogin) {
        // Respect ?next= redirect param if present
        let next = "/";
        try {
          const search = typeof window !== 'undefined' ? window.location.search : '';
          const sp = new URLSearchParams(search);
          const n = sp.get('next');
          if (n && n.startsWith('/')) next = n;
        } catch {}
        router.push(next);
      }
    }, [session, isLoading, pathname, router]);
    
    // Auto-create a trainer row on first login (no Connect)
    useEffect(() => {
      const ensureTrainer = async () => {
        try {
          if (!session?.user?.id) return;
          const uid = session.user.id;
          const { data } = await supabase
            .from('trainer')
            .select('trainer_id')
            .eq('creator_id', uid)
            .limit(1);
          if (!data || !data.length) {
            const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
              ? (crypto as any).randomUUID()
              : Math.random().toString(36).slice(2) + Date.now().toString(36);
            await supabase.from('trainer').insert({ creator_id: uid, trainer_id: newId });
          }
        } catch {}
      };
      ensureTrainer();
    }, [session?.user?.id, supabase]);

    // First-run redirect to onboarding if missing photo or tiers
    useEffect(() => {
      const checkOnboarding = async () => {
        try {
          if (!session?.user?.id) return;
          const uid = session.user.id;
          const { data: tRow } = await supabase
            .from('trainer')
            .select('trainer_id, photo_url')
            .eq('creator_id', uid)
            .limit(1);
          const tId = (tRow?.[0]?.trainer_id as string) || null;
          const photo = (tRow?.[0]?.photo_url as string) || null;
          let tiersCount = 0;
          if (tId) {
            const { count } = await supabase
              .from('tiers')
              .select('*', { count: 'exact', head: true })
              .eq('trainer', tId)
              .eq('active', true);
            tiersCount = typeof count === 'number' ? count : 0;
          }
          const should = !!tId && (tiersCount === 0 || !photo)
          const isOnboarding = pathname === '/onboarding'
          const isPublic = pathname === '/join' || pathname === '/login'
          if (should && !isOnboarding && !isPublic) {
            router.push('/onboarding')
          }
        } catch {}
      }
      checkOnboarding()
    }, [session?.user?.id, pathname, supabase, router])

    return null;
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SupabaseProvider>
          <AuthRedirect />
          <AppRouterCacheProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              {children}
            </ThemeProvider>
          </AppRouterCacheProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
