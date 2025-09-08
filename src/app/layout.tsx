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

import { useSessionContext } from "@supabase/auth-helpers-react";

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
