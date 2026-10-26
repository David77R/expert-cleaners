import { NavigationTrail } from "@/components/back-link";
import type { Metadata, Viewport } from "next";
import { BrandProvider } from "@/components/brand-provider";
import { PLATFORM, brandIcon, brandStyle } from "@/domain/companies";
import { getBrand, hasSession } from "@/server/auth";
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
  if (!(await hasSession())) {
    return {
      title: PLATFORM.name,
      description: PLATFORM.description,
      appleWebApp: { capable: true, title: PLATFORM.name, statusBarStyle: "black-translucent" },
      icons: { apple: `${PLATFORM.icons}/apple-icon.png`, icon: `${PLATFORM.icons}/icon-192.png` },
      openGraph: {
        title: PLATFORM.name,
        description: PLATFORM.description,
        siteName: PLATFORM.name,
        type: "website",
        images: [{ url: PLATFORM.image, width: 1200, height: 630, alt: PLATFORM.name }],
      },
      twitter: {
        card: "summary_large_image",
        title: PLATFORM.name,
        description: PLATFORM.description,
        images: [PLATFORM.image],
      },
    };
  }
  const brand = await getBrand();
  return {
    title: brand.shortName,
    description: "Operación diaria: calendario, rutas y citas",
    appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "black-translucent" },
    icons: { apple: brandIcon(brand, "apple-icon.png"), icon: brandIcon(brand, "icon-192.png") },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const themeColor = (await hasSession()) ? (await getBrand()).themeColor : PLATFORM.themeColor;
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor };
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
