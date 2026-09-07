import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DATUK - Dashboard Pagu & Realisasi",
  description: "Dashboard pagu, realisasi, dan proyeksi anggaran satker",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
