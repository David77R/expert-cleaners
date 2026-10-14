import {
  addAddressAction,
  deleteAddressAction,
  relocateAddressAction,
  updateAddressAction,
} from "@/app/customers/[id]/actions";
import { ActionForm } from "@/components/action-form";
import { AddressFields } from "@/components/address-fields";
import { Icon } from "@/components/icons";
import { Expandable } from "@/components/panel-kit";
import type { Address } from "@/db/schema";

function mapsHref(address: Address): string {
  return `https://www.google.com/maps/search/?api=1&query=${address.lat},${address.lng}`;
}

export function CustomerAddresses({ customerId, addresses }: { customerId: string; addresses: Address[] }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => {
          const located = address.lat !== null && address.lng !== null;
          return (
            <li key={address.id} className="flex flex-col gap-3 rounded-md border border-hair bg-paper p-4">
              <div className="flex gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    located ? "bg-info-soft text-info" : "bg-attention-soft text-attention"
                  }`}
                >
                  <Icon name={located ? "pin" : "alert"} size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">
                    {address.line1}
                    {address.unit ? `, ${address.unit}` : ""}
                  </span>
                  <span className="text-soft">
                    {address.city}, {address.state} {address.zip}
                  </span>
                  {address.notes && <span className="mt-1 text-xs text-muted">{address.notes}</span>}
                  {located ? (
                    <a
                      href={mapsHref(address)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 w-fit text-xs font-semibold text-brand-ink underline underline-offset-2"
                    >
                      Ver dónde quedó en Google Maps
                    </a>
                  ) : (
                    <span className="mt-1.5 text-xs font-semibold text-attention">
                      Sin ubicar: no aparece en el mapa
                    </span>
                  )}
                </span>
              </div>
              <Expandable title="Corregir dirección">
                <div className="flex flex-col gap-3">
                  <ActionForm
                    action={updateAddressAction.bind(null, customerId, address.id)}
                    submit="Guardar dirección"
                    pendingText="Guardando…"
                    tone="primary"
                  >
                    <AddressFields defaults={address} />
                    <p className="text-xs text-soft">
                      Para que quede exacta en el mapa, escribe la calle y elige la sugerencia correcta.
                    </p>
                  </ActionForm>
                  <ActionForm
                    action={relocateAddressAction.bind(null, customerId, address.id)}
                    submit="Volver a ubicar con los datos actuales"
                    pendingText="Ubicando…"
                  />
                  {addresses.length > 1 && (
                    <ActionForm
                      action={deleteAddressAction.bind(null, customerId, address.id)}
                      submit="Eliminar dirección"
                      pendingText="Eliminando…"
                      tone="danger"
                    />
                  )}
                </div>
              </Expandable>
            </li>
          );
        })}
      </ul>
      <Expandable title="Agregar otra dirección">
        <ActionForm
          action={addAddressAction.bind(null, customerId)}
          submit="Agregar dirección"
          pendingText="Guardando…"
          tone="primary"
        >
          <AddressFields />
        </ActionForm>
      </Expandable>
    </div>
  );
}
