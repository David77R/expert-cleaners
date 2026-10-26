import { NavigationTrail } from "@/components/back-link";
import type { Metadata, Viewport } from "next";
import { BrandProvider } from "@/components/brand-provider";
import { brandIcon, brandStyle } from "@/domain/companies";
import { getBrand } from "@/server/auth";
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

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.shortName,
    description: "Operación diaria: calendario, rutas y citas",
    appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "black-translucent" },
    icons: { apple: brandIcon(brand, "apple-icon.png"), icon: brandIcon(brand, "icon-192.png") },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const brand = await getBrand();
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: brand.themeColor };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const brand = await getBrand();
  return (
    <html lang="es" className={`${plex.variable} ${grotesk.variable} h-full antialiased`} style={brandStyle(brand)}>
      <body className="min-h-full flex flex-col">
        <BrandProvider brand={brand}>
          <NavigationTrail />
          {children}
        </BrandProvider>
      </body>
    </html>
  );
}
