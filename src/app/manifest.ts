import type { MetadataRoute } from "next";
import { PLATFORM, brandIcon } from "@/domain/companies";
import { getBrand, hasSession } from "@/server/auth";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  if (!(await hasSession())) {
    return {
      name: PLATFORM.name,
      short_name: PLATFORM.name,
      description: PLATFORM.description,
      start_url: "/inicio",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: PLATFORM.themeColor,
      theme_color: PLATFORM.themeColor,
      lang: "es",
      icons: [
        { src: `${PLATFORM.icons}/icon-192.png`, sizes: "192x192", type: "image/png" },
        { src: `${PLATFORM.icons}/icon-512.png`, sizes: "512x512", type: "image/png" },
        { src: `${PLATFORM.icons}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    };
  }
  const brand = await getBrand();
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: "Operación diaria: calendario, rutas y citas",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.theme["--canvas"] ?? "#eef2f1",
    theme_color: brand.themeColor,
    lang: "es",
    icons: [
      { src: brandIcon(brand, "icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: brandIcon(brand, "icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: brandIcon(brand, "icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
