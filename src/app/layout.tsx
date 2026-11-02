import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";

import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";
import "./landing.css";
import "./workspace.css";

const display = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});


export const metadata: Metadata = {
  title: "JobAutomation â€” a clearer job search",
  description:
    "A thoughtful workspace for organizing your experience, exploring opportunities, and preparing applications with you in control.",
};


export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const stored = (await cookies()).get("jobautomation-theme")?.value;
  const theme = stored === "dark" || stored === "auto" ? stored : undefined;

  return (
    <html className={display.variable} data-scroll-behavior="smooth" data-theme={theme} lang="en">
      <body>
        <noscript>
          <style>{`.reveal { opacity: 1 !important; transform: none !important; }`}</style>
        </noscript>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
