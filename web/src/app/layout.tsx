import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Splash - LinkedIn AI Content Pipeline",
  description: "Scrape top voices, analyze patterns, generate LinkedIn posts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
