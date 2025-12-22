'use client';
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import "./globals.css";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import SupabaseProvider from "../components/SupabaseProvider"
import BreathingDots from "../components/breathingDots";

import { useSessionContext, useSupabaseClient } from "@supabase/auth-helpers-react";
import { relative } from "path";

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
      background: { default: "#0f0f10", paper: "rgba(255,255,255,0.06)" },
      text: { primary: "#EAEAEA", secondary: "#B0B0B0" },
      divider: "#2a2a2a",
    },
    shape: { borderRadius: 10 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: "rgba(255,255,255,0.06)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            backgroundImage:
              "radial-gradient(800px 200px at -10% -20%, rgba(26,224,128,0.08), transparent)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            borderColor: "#2a2a2a",
            borderWidth: 1,
            borderStyle: 'solid',
            backgroundColor: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            '&:hover': {
              backgroundColor: "rgba(255,255,255,0.08)",
              borderColor: "#3a3a3a",
            },
          },
          containedPrimary: { color: "#0b0b0b" },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundColor: "rgba(17,17,17,0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          },
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
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.04)'
            },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: "#3a3a3a" },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: "#4a4a4a" },
            '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: "#5a5a5a" },
          },
        },
      },
    },
  });

  function AuthRedirect() {
    const { session, isLoading } = useSessionContext();
    const supabase = useSupabaseClient();
    const pathname = usePathname();
    const userId = session?.user?.id ?? null;
    const isLoggedIn = !!session?.user;
    useEffect(() => {
      if (isLoading) return; // wait until session is resolved
      const onLogin = pathname === "/login";
      const isPublic = pathname === "/join"; // allow public invite page
      if (!isLoggedIn && !onLogin && !isPublic) {
        router.replace("/login");
        return;
      }
      if (isLoggedIn && onLogin) {
        if (!userId) return;
        let cancelled = false;
        const redirectAfterLogin = async () => {
          // Respect ?next= redirect param if present
          let next = "/";
          try {
            const search = typeof window !== 'undefined' ? window.location.search : '';
            const sp = new URLSearchParams(search);
            const n = sp.get('next');
            if (n && n.startsWith('/')) next = n;
          } catch {}
          if (next === "/" || next === "") {
            try {
              const { data, error } = await supabase
                .from('trainer')
                .select('trainer_id')
                .eq('creator_id', userId)
                .limit(1);
              const hasTrainer = !error && !!data?.[0]?.trainer_id;
              if (!hasTrainer) next = "/join";
            } catch {
              next = "/join";
            }
          }
          if (!cancelled) router.replace(next);
        };
        redirectAfterLogin();
        return () => { cancelled = true; };
      }
    }, [isLoggedIn, userId, isLoading, pathname, router, supabase]);

    useEffect(() => {
      if (isLoading) return;
      if (!userId) return;
      const openPaths = ["/login", "/join", "/onboarding"];
      if (openPaths.includes(pathname)) return;
      let cancelled = false;
      const enforceTrainerAccess = async () => {
        try {
          const { data, error } = await supabase
            .from('trainer')
            .select('trainer_id')
            .eq('creator_id', userId)
            .limit(1);
          const hasTrainer = !error && !!data?.[0]?.trainer_id;
          if (!hasTrainer && !cancelled) router.replace("/join");
        } catch {
          if (!cancelled) router.replace("/join");
        }
      };
      enforceTrainerAccess();
      return () => { cancelled = true; };
    }, [userId, isLoading, pathname, router, supabase]);

    // First-run redirect to onboarding if missing photo or tiers
    useEffect(() => {
      const checkOnboarding = async () => {
        try {
          if (!userId) return;
          const uid = userId;
          const { data: tRow } = await supabase
            .from('trainer')
            .select('trainer_id')
            .eq('creator_id', uid)
            .limit(1);
          const tId = (tRow?.[0]?.trainer_id as string) || null;
          let tiersCount = 0;
          if (tId) {
            const { count } = await supabase
              .from('tiers')
              .select('*', { count: 'exact', head: true })
              .eq('trainer', tId)
              .eq('active', true);
            tiersCount = typeof count === 'number' ? count : 0;
          }
          const should = !tId
          const isOnboarding = pathname === '/onboarding'
          const isPublic = pathname === '/join' || pathname === '/login'
          if (should && !isOnboarding && !isPublic) {
            router.push('/onboarding')
          }
        } catch {}
      }
      checkOnboarding()
    }, [userId, pathname, supabase, router])

    return null;
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0, // Keep at 0
            pointerEvents: 'none',
          }}
        >
          <BreathingDots />
        </div>
        <SupabaseProvider>
          <AuthRedirect />
          <AppRouterCacheProvider>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <div >
                <div className="relative z-10">
                  {children}
                </div>
              </div>
            </ThemeProvider>
          </AppRouterCacheProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
