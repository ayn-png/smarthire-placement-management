import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/providers/ThemeProvider";
import ServiceWorkerRegistrar from "@/components/providers/ServiceWorkerRegistrar";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export const metadata: Metadata = {
  title: "SmartHire - College Placement Management System",
  description:
    "Enterprise-grade college placement management with AI interview preparation",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  applicationName: "SmartHire",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SmartHire",
  },
  manifest: "/manifest.json",
  other: {
    // W3C standard companion to apple-mobile-web-app-capable — silences the
    // browser deprecation warning: "apple-mobile-web-app-capable is deprecated.
    // Please include mobile-web-app-capable instead."
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable}`}>
        <AuthProvider>
          <ThemeProvider>
            <ServiceWorkerRegistrar />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
