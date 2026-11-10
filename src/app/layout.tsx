import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { t } from "@/messages";
import "./globals.css";

export const metadata: Metadata = {
  title: t("en", "app.name"),
  description: t("en", "app.tagline"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
