import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Roman Poll | College Football Top 25", template: "%s | Roman Poll" },
  description: "An independent college football Top 25, voted on by friends. Weekly rankings, transparent ballots, and a different perspective.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${geist.variable} ${geistMono.variable}`}><body>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader /><main id="main-content" tabIndex={-1}>{children}</main><SiteFooter />
  </body></html>;
}
