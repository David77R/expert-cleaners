import { Icon } from "@/components/icons";

export function isUnlocated(address: { lat: number | null; lng: number | null }): boolean {
  return address.lat == null || address.lng == null;
}

export function UnlocatedAddressAlert() {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-attention/50 bg-attention-soft px-3 py-2.5 text-sm text-attention"
    >
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>
        <span className="block font-semibold">Dirección sin ubicar</span>
        <span className="block text-xs">
          No aparece en el mapa ni en las rutas. Corrígela abajo y elige la sugerencia correcta.
        </span>
      </span>
    </p>
  );
}
