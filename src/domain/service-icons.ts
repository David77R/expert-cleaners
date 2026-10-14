import { slugify } from "./service-rules";

export const SERVICE_ICONS = {
  sofa: "Sofá",
  armchair: "Sillón",
  chair: "Silla",
  stool: "Banco o taburete",
  ottoman: "Ottoman o puff",
  cushion: "Cojín",
  mattress: "Colchón",
  bed: "Cama",
  frame: "Esqueleto de mueble",
  cover: "Forro o funda",
  rug: "Tapete o rug",
  carpet: "Alfombra",
  antislip: "Antideslizante",
  curtain: "Cortina",
  blinds: "Persiana",
  car: "Carro",
  shoe: "Zapato",
  bottle: "Producto o químico",
  laundry: "Lavandería",
  house: "Limpieza residencial",
  truck: "Recogida o entrega",
  tools: "Instalación",
  rework: "Reproceso",
  sparkles: "Promoción",
  ban: "Anulado",
  tag: "Otro",
} as const;

export type ServiceIconKey = keyof typeof SERVICE_ICONS;

export const SERVICE_ICON_KEYS = Object.keys(SERVICE_ICONS) as ServiceIconKey[];

const RULES: [ServiceIconKey, string[]][] = [
  ["rework", ["reproceso", "rework", "rehacer"]],
  ["ban", ["anulado", "void", "cancelado"]],
  ["sparkles", ["promo", "promocion", "oferta", "descuento"]],
  ["frame", ["esqueleto", "frame", "estructura"]],
  ["cover", ["forro", "forros", "funda", "fundas", "cover"]],
  ["antislip", ["antideslizante", "pad", "underlay"]],
  ["tools", ["desinstalar", "instalar", "instalacion", "install"]],
  ["truck", ["recogida", "entrega", "pickup", "delivery", "traslado"]],
  ["bottle", ["odor", "olor", "spray", "producto", "quimico", "desinfeccion"]],
  ["house", ["residencial", "casa", "hogar", "home", "house", "apartamento"]],
  ["laundry", ["lavanderia", "laundry", "lavado", "ropa"]],
  ["armchair", ["sillon", "sillones", "recliner", "reclinable", "armchair", "butaca"]],
  [
    "sofa",
    ["sofa", "sofas", "couch", "loveseat", "sectional", "seccional", "mueble", "muebles", "upholstery", "tapiceria"],
  ],
  ["stool", ["banco", "bancos", "taburete", "taburetes", "stool", "barstool"]],
  ["ottoman", ["ottoman", "otoman", "puff", "pouf"]],
  ["chair", ["silla", "sillas", "chair", "chairs", "comedor"]],
  ["cushion", ["cojin", "cojines", "cushion", "almohada", "almohadas", "pillow"]],
  ["mattress", ["colchon", "colchones", "mattress"]],
  ["bed", ["cama", "camas", "bed", "cabecero", "headboard"]],
  ["rug", ["rug", "rugs", "tapete", "tapetes", "persa", "persas"]],
  ["carpet", ["alfombra", "alfombras", "carpet", "carpets", "moqueta"]],
  ["curtain", ["cortina", "cortinas", "curtain", "drape", "drapes"]],
  ["blinds", ["blinds", "persiana", "persianas", "zebra"]],
  ["car", ["carro", "auto", "car", "vehiculo", "coche", "interior"]],
  ["shoe", ["zapato", "zapatos", "shoe", "shoes", "tenis", "sneaker", "sneakers"]],
];

export function isServiceIcon(value: unknown): value is ServiceIconKey {
  return typeof value === "string" && value in SERVICE_ICONS;
}

export function guessServiceIcon(service: {
  name: string;
  slug?: string | null;
  category?: string | null;
}): ServiceIconKey {
  const words = new Set(
    [service.name, service.slug ?? "", service.category ?? ""].flatMap((part) => slugify(part).split("-")),
  );
  const nameWords = new Set([service.name, service.slug ?? ""].flatMap((part) => slugify(part).split("-")));
  for (const pool of [nameWords, words]) {
    for (const [icon, keywords] of RULES) {
      if (keywords.some((keyword) => pool.has(keyword))) return icon;
    }
  }
  return "tag";
}

export function serviceIconOf(service: {
  name: string;
  slug?: string | null;
  category?: string | null;
  icon?: string | null;
}): ServiceIconKey {
  return isServiceIcon(service.icon) ? service.icon : guessServiceIcon(service);
}
