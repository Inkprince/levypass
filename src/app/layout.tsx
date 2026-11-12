import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { t } from "@/messages";
import "./globals.css";

// Plus Jakarta Sans, SIL Open Font License (fonts/OFL.txt). Self-hosted so builds need no network.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-Variable.ttf",
  weight: "200 800",
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: t("en", "app.name"), template: `%s - ${t("en", "app.name")}` },
  description: t("en", "app.tagline"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f3d2e" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      {/* Extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before hydration. */}
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
