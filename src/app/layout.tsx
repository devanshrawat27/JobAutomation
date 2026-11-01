import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fraunces, Manrope } from "next/font/google";

import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";
import "./landing.css";
import "./workspace.css";

const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
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
    <html className={`${display.variable} ${body.variable}`} data-scroll-behavior="smooth" data-theme={theme} lang="en">
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
