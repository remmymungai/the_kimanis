import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Kimanis — Party Hub",
  description: "Remmy & Mbete's Engagement Party Game Hub",
  icons: { icon: "/favicon.ico" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kimanis Hub",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F5F0E8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased no-tap-highlight">{children}</body>
    </html>
  );
}
