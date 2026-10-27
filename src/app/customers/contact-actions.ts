"use server";

import { getDb } from "@/db/client";
import { assertTechnicianCustomer } from "@/server/technician-access";
import { contactHref, type ContactChannel } from "@/domain/phone-privacy";
import { getActor } from "@/server/auth";
import { getCustomerSummary } from "@/server/customers";

export async function customerContactHref(
  customerId: string,
  channel: ContactChannel,
  text?: string,
): Promise<{ ok: true; href: string } | { ok: false; message: string }> {
  const actor = await getActor({ allowTechnician: true });
  if (!actor) return { ok: false, message: "Tu sesión terminó. Vuelve a iniciar sesión." };
  const allowed = await assertTechnicianCustomer(getDb(), actor, customerId).then(
    () => true,
    () => false,
  );
  if (!allowed) return { ok: false, message: "Este cliente no tiene citas contigo." };
  const customer = await getCustomerSummary(getDb(), actor.companyId, customerId).catch(() => null);
  if (!customer?.phone) return { ok: false, message: "Este cliente no tiene teléfono registrado." };
  return { ok: true, href: contactHref(customer.phone, channel, text) };
}
