import Image from "next/image";
import { client } from "@/config/clients";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const height = size === "sm" ? 36 : size === "lg" ? 56 : 44;
  if (client.logo) {
    const width = Math.round((client.logo.width / client.logo.height) * height);
    return (
      <Image
        src={client.logo.src}
        alt={client.name}
        width={width}
        height={height}
        priority
        className="shrink-0 object-contain"
        style={{ height, width }}
      />
    );
  }
  const box = size === "sm" ? "h-9 w-9 text-sm" : size === "lg" ? "h-10 w-10 text-base" : "h-9 w-9 text-sm";
  return (
    <span
      className={`font-display flex shrink-0 items-center justify-center rounded-md bg-brand font-bold text-white ${box}`}
    >
      {client.initials}
    </span>
  );
}
