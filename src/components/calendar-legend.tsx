import { Icon } from "@/components/icons";
import type { CalendarTechnician } from "@/components/calendar-types";

export function CalendarLegend({ technicians }: { technicians: CalendarTechnician[] }) {
  return (
    <section aria-label="Cómo leer el calendario" className="grid gap-x-10 gap-y-3 text-xs text-soft md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">Técnicos</h2>
        <ul className="flex flex-col gap-1.5">
          {technicians.map((technician) => (
            <li key={technician.id} className="flex items-center gap-2">
              <span className="h-3 w-1.5 rounded-[1px]" style={{ backgroundColor: technician.color }} />
              <span className="font-medium text-ink">{technician.name}</span>
              <span>{technician.zone}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-ink">Estados de las citas</h2>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <span className="h-4 w-8 rounded-[3px] border border-dashed border-warning/70 bg-paper" />
            Borde punteado: falta confirmar
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-8 rounded-[3px] border border-hair bg-paper" />
            Borde continuo: confirmada
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-8 rounded-[3px] border border-info/40 bg-info-soft/70" />
            Azul: reprogramada
          </li>
          <li className="flex items-center gap-2">
            <span className="h-4 w-8 rounded-[3px] border border-brand/40 bg-brand-soft/70" />
            Turquesa: completada
          </li>
          <li className="flex items-center gap-2">
            <span className="hatch h-4 w-8 rounded-[3px] border border-hair bg-paper" />
            Rayado: cancelada
          </li>
          <li className="flex items-center gap-2 text-attention">
            <span className="flex h-4 w-8 items-center justify-center rounded-[3px] border border-attention bg-paper">
              <Icon name="alert" size={11} />
            </span>
            Borde rojo: en conflicto con otra cita
          </li>
        </ul>
      </div>
    </section>
  );
}
