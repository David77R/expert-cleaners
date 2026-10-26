import { INPUT } from "@/components/form-kit";
import { VEHICLE_SIZES, VEHICLE_SIZE_LABELS } from "@/domain/vehicles";

const LABEL = "flex flex-col gap-1 text-xs font-medium text-soft";
const FIELD = `${INPUT} py-2`;

export type VehicleDefaults = Partial<{
  make: string;
  model: string;
  year: number | null;
  color: string;
  plate: string;
  size: string;
  notes: string;
}>;

export function VehicleFields({
  defaults = {},
  withNotes = true,
}: {
  defaults?: VehicleDefaults;
  withNotes?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-3">
      <label className={LABEL}>
        Tipo de vehículo
        <select name="size" defaultValue={defaults.size ?? "sedan"} className={FIELD}>
          {VEHICLE_SIZES.map((size) => (
            <option key={size} value={size}>
              {VEHICLE_SIZE_LABELS[size]}
            </option>
          ))}
        </select>
      </label>
      <label className={LABEL}>
        Marca
        <input name="make" defaultValue={defaults.make ?? ""} placeholder="Toyota" maxLength={40} className={FIELD} />
      </label>
      <label className={LABEL}>
        Modelo
        <input name="model" defaultValue={defaults.model ?? ""} placeholder="Camry" maxLength={40} className={FIELD} />
      </label>
      <label className={LABEL}>
        Año
        <input
          name="year"
          inputMode="numeric"
          defaultValue={defaults.year ?? ""}
          placeholder="2021"
          maxLength={4}
          className={FIELD}
        />
      </label>
      <label className={LABEL}>
        Color
        <input name="color" defaultValue={defaults.color ?? ""} placeholder="Blanco" maxLength={30} className={FIELD} />
      </label>
      <label className={LABEL}>
        Placa
        <input
          name="plate"
          defaultValue={defaults.plate ?? ""}
          placeholder="ABC1234"
          maxLength={12}
          className={`${FIELD} uppercase`}
        />
      </label>
      {withNotes && (
        <label className={`${LABEL} col-span-full`}>
          Notas
          <input
            name="notes"
            defaultValue={defaults.notes ?? ""}
            placeholder="Ej: rines delicados, pelos de mascota…"
            maxLength={300}
            className={FIELD}
          />
        </label>
      )}
    </div>
  );
}
