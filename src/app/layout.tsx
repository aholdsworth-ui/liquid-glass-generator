import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google for Startups — Glass Panel & Pill Generator",
  description: "Create brand-calibrated Liquid Glass panels and pills to exact pixel sizes."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
