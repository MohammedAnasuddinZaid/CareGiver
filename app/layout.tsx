import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "MemoryAssist — Helping familiar faces stay familiar",
    template: "%s · MemoryAssist",
  },
  description:
    "A privacy-first assistive web app that helps people with memory impairment recognize the people who matter most — entirely on-device.",
  applicationName: "MemoryAssist",
  appleWebApp: { capable: true, title: "MemoryAssist", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Applied before hydration so accessibility modes never flash:
 * reads saved settings (or OS preferences) and sets classes on <html>.
 */
const settingsBootstrap = `
(function(){try{
  var s=null;try{s=JSON.parse(localStorage.getItem('ma.settings.v1'));}catch(e){}
  var r=document.documentElement;
  function mq(q){return window.matchMedia&&window.matchMedia(q).matches;}
  if(!s){s={};}
  r.classList.toggle('large-text', !!s.largeText);
  r.classList.toggle('high-contrast', !!s.highContrast);
  r.classList.toggle('reduce-motion', typeof s.reduceMotion==='boolean' ? !!s.reduceMotion : mq('(prefers-reduced-motion: reduce)'));
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: settingsBootstrap }} />
      </head>
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
