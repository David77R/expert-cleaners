import Image from "next/image";
import type { Brand } from "@/domain/companies";

export function BrandMark({
  brand,
  size = "md",
}: {
  brand: Pick<Brand, "logo" | "name" | "initials">;
  size?: "sm" | "md" | "lg";
}) {
  const height = size === "sm" ? 36 : size === "lg" ? 56 : 44;
  if (brand.logo) {
    const width = Math.round((brand.logo.width / brand.logo.height) * height);
    return (
      <Image
        src={brand.logo.src}
        alt={brand.name}
        width={width}
        height={height}
        priority
        unoptimized={/^https?:/.test(brand.logo.src)}
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
      {brand.initials}
    </span>
  );
}
