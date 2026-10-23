import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Westeel Buildings",
  description: "Westeel Buildings employee portal",
  icons: {
    icon: "/westeel-logo-cropped.png",
    apple: "/westeel-logo-cropped.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen spatial-canvas text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
