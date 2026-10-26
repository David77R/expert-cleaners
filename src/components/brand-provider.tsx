"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Brand } from "@/domain/companies";

const BrandContext = createContext<Brand | null>(null);

export function BrandProvider({ brand, children }: { brand: Brand; children: ReactNode }) {
  return <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  const brand = useContext(BrandContext);
  if (!brand) throw new Error("useBrand necesita BrandProvider");
  return brand;
}
