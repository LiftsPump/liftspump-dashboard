'use client';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v13-appRouter";
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

  function AuthRedirect() {
    const { session, isLoading } = useSessionContext();
    const pathname = usePathname();
    useEffect(() => {
      if (isLoading) return; // wait until session is resolved
      const onLogin = pathname === "/login";
      if (!session?.user && !onLogin) router.push("/login");
      if (session?.user && onLogin) router.push("/");
    }, [session, isLoading, pathname, router]);
    return null;
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <SupabaseProvider>
          <AuthRedirect />
          <AppRouterCacheProvider>
            {children}
          </AppRouterCacheProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
