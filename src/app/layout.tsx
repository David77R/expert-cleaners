import { NavigationTrail } from "@/components/back-link";
import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { client, iconPath } from "@/config/clients";
import localFont from "next/font/local";
import "./globals.css";

const plex = localFont({
  variable: "--font-plex",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});
const grotesk = localFont({
  variable: "--font-grotesk",
  display: "swap",
  src: [
    { path: "./fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: client.shortName,
  description: "Operación diaria: calendario, rutas y citas",
  appleWebApp: { capable: true, title: client.shortName, statusBarStyle: "black-translucent" },
  icons: { apple: iconPath("apple-icon.png"), icon: iconPath("icon-192.png") },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: client.themeColor,
};

const themeStyle = { ...client.theme, "--tint": client.backgroundTint } as CSSProperties;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${plex.variable} ${grotesk.variable} h-full antialiased`} style={themeStyle}>
      <body className="min-h-full flex flex-col">
        <NavigationTrail />
        {children}
      </body>
    </html>
  );
}
