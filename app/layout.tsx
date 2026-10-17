import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Westeel Buildings | Internal Dashboard",
  description: "Management and operations visibility dashboard for Westeel Buildings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
