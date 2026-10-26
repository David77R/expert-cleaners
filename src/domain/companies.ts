import type { ClientConfig } from "@/config/clients";

export type CompanySettings = Omit<ClientConfig, "id" | "name">;

export const EXPERT_CLEANERS_COMPANY_ID = "00000000-0000-4000-8000-00000000c001";
export const RVA_COMPANY_ID = "00000000-0000-4000-8000-00000000c002";

export const ACTIVE_COMPANY_COOKIE = "cc-company";
