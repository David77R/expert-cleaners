import { addVehicleAction, deleteVehicleAction, updateVehicleAction } from "@/app/customers/[id]/actions";
import { ActionForm } from "@/components/action-form";
import { Icon } from "@/components/icons";
import { Expandable } from "@/components/panel-kit";
import { VehicleFields } from "@/components/vehicle-fields";
import type { Vehicle } from "@/db/schema";
import { sizeLabel, vehicleName } from "@/domain/vehicles";

export function CustomerVehicles({ customerId, vehicles }: { customerId: string; vehicles: Vehicle[] }) {
  return (
    <div className="flex flex-col gap-3">
      {vehicles.length === 0 ? (
        <p className="rounded-md border border-dashed border-hair bg-paper px-4 py-6 text-center text-sm text-muted">
          Este cliente todavía no tiene vehículos registrados.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id} className="flex flex-col gap-3 rounded-md border border-hair bg-paper p-4">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
                  <Icon name="car" size={18} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col text-sm">
                  <span className="font-medium">{vehicleName(vehicle)}</span>
                  <span className="text-soft">
                    {[sizeLabel(vehicle.size), vehicle.color, vehicle.plate ? `Placa ${vehicle.plate}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {vehicle.notes && <span className="mt-1 text-xs text-muted">{vehicle.notes}</span>}
                </span>
              </div>
              <Expandable title="Editar vehículo">
                <div className="flex flex-col gap-3">
                  <ActionForm
                    action={updateVehicleAction.bind(null, customerId, vehicle.id)}
                    submit="Guardar vehículo"
                    pendingText="Guardando…"
                    tone="primary"
                  >
                    <VehicleFields defaults={vehicle} />
                  </ActionForm>
                  <ActionForm
                    action={deleteVehicleAction.bind(null, customerId, vehicle.id)}
                    submit="Eliminar vehículo"
                    pendingText="Eliminando…"
                  />
                </div>
              </Expandable>
            </li>
          ))}
        </ul>
      )}
      <Expandable title="Agregar vehículo">
        <ActionForm
          action={addVehicleAction.bind(null, customerId)}
          submit="Agregar vehículo"
          pendingText="Guardando…"
          tone="primary"
        >
          <VehicleFields />
        </ActionForm>
      </Expandable>
    </div>
  );
}
