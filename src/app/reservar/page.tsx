import { redirect } from "next/navigation";
import { getBrand } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function BookingRedirect({ searchParams }: PageProps<"/reservar">) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query}` : "";
  redirect(`/reservar/${(await getBrand()).slug}${suffix}`);
}
