import type { MetadataRoute } from "next";
import { client, iconPath } from "@/config/clients";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: client.name,
    short_name: client.shortName,
    description: "Operación diaria: calendario, rutas y citas",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: client.theme["--canvas"] ?? "#eef2f1",
    theme_color: client.themeColor,
    lang: "es",
    icons: [
      { src: iconPath("icon-192.png"), sizes: "192x192", type: "image/png" },
      { src: iconPath("icon-512.png"), sizes: "512x512", type: "image/png" },
      { src: iconPath("icon-maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
