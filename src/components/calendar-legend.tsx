import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { LegendDisclosure } from "@/components/legend-disclosure";
import { client } from "@/config/clients";
import { initialsOf, readableOn } from "@/domain/calendar-view";
import type { CalendarTechnician } from "@/components/calendar-types";

const SAMPLE_COLOR = "#1E9BD7";

function Sample({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={`relative flex h-11 w-16 shrink-0 flex-col overflow-hidden rounded-md border text-[8px] ${className}`}
      style={{ backgroundColor: `${SAMPLE_COLOR}1f`, borderColor: `${SAMPLE_COLOR}99` }}
    >
      {children}
    </span>
  );
}

function Header({ children }: { children?: ReactNode }) {
  return (
    <span
      className="flex h-3.5 shrink-0 items-center justify-end gap-0.5 px-1"
      style={{ backgroundColor: SAMPLE_COLOR }}
    >
      {children}
    </span>
  );
}

function Item({ sample, title, text }: { sample: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-hair bg-paper px-3 py-2.5">
      {sample}
      <span className="min-w-0 leading-snug">
        <span className="block text-[13px] font-semibold text-ink">{title}</span>
        <span className="block text-xs text-soft">{text}</span>
      </span>
    </li>
  );
}

export function CalendarLegend({ technicians }: { technicians: CalendarTechnician[] }) {
  return (
    <section
      aria-label="Cómo leer el calendario"
      className="flex flex-col gap-4 rounded-xl border border-hair bg-canvas/50 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="font-display text-sm font-semibold">Técnicos</h2>
        <ul className="flex flex-wrap gap-2">
          {technicians.map((technician) => (
            <li
              key={technician.id}
              className="flex items-center gap-2 rounded-full border border-hair bg-paper py-1 pl-1 pr-3 text-xs"
            >
              <span
                className="font-display flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: technician.color, color: readableOn(technician.color) }}
              >
                {initialsOf(technician.name)}
              </span>
              <span className="font-semibold">{technician.name}</span>
              <span className="text-muted">{technician.zone}</span>
            </li>
          ))}
        </ul>
        <span className="hidden text-xs text-muted sm:inline">Cada cita lleva el color de su técnico.</span>
      </div>

      <LegendDisclosure title="Cómo leer cada cita y el mapa">
        <div className="flex flex-col gap-2">
          <h2 className="font-display hidden text-sm font-semibold lg:block">Cómo leer cada cita</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
            <Item
              title="Sin confirmar"
              text="Franja amarilla arriba. Llama al cliente para confirmar."
              sample={
                <Sample className="!border-2 !border-warning">
                  <span className="flex h-3 shrink-0 items-center whitespace-nowrap bg-warning px-1 text-[6.5px] font-bold uppercase text-white">
                    Sin confirmar
                  </span>
                  <Header />
                </Sample>
              }
            />
            <Item
              title="Confirmada, reprogramada o completada"
              text="La etiqueta de abajo dice el estado."
              sample={
                <Sample>
                  <Header />
                  <span className="mt-auto mb-1 ml-1 w-fit rounded-sm bg-success-soft px-1 font-semibold text-success">
                    Confirmada
                  </span>
                </Sample>
              }
            />
            <Item
              title="En conflicto"
              text="Borde rojo y triángulo. Pasa el mouse o tócalo para ver con qué cita choca."
              sample={
                <Sample className="!border-2 !border-attention">
                  <Header>
                    <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-white text-attention">
                      <Icon name="alert" size={7} />
                    </span>
                  </Header>
                </Sample>
              }
            />
            <Item
              title="Dirección sin ubicar"
              text="Pin rojo. No sale en el mapa: corrige la dirección en la cita."
              sample={
                <Sample>
                  <Header>
                    <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-attention text-white">
                      <Icon name="pin" size={7} />
                    </span>
                  </Header>
                </Sample>
              }
            />
            <Item
              title="Cita estándar"
              text="Sin franja: una sola visita, sin recogida ni entrega."
              sample={
                <Sample>
                  <Header />
                </Sample>
              }
            />
            {client.features.rugPickup && (
              <>
                <Item
                  title="Alfombras: recogida"
                  text="Franja morada. Solo las alfombras llevan recogida y entrega."
                  sample={
                    <Sample>
                      <span className="flex h-3 shrink-0 items-center whitespace-nowrap bg-indigo px-1 text-[6.5px] font-bold uppercase text-white">
                        Recogida
                      </span>
                      <Header />
                    </Sample>
                  }
                />
                <Item
                  title="Alfombras: entrega"
                  text="Franja verde y borde punteado. Se ven al activar «Entregas»."
                  sample={
                    <Sample className="!border-2 border-dashed">
                      <span className="flex h-3 shrink-0 items-center whitespace-nowrap bg-success px-1 text-[6.5px] font-bold uppercase text-white">
                        Entrega
                      </span>
                      <Header />
                    </Sample>
                  }
                />
              </>
            )}
            <Item
              title="Cancelada"
              text="Se ve tenue y con el texto tachado."
              sample={
                <Sample className="opacity-50">
                  <Header />
                  <span className="mx-1 mt-1 h-1 rounded-full bg-ink/40" />
                  <span className="mx-1 mt-1 h-px bg-ink/60" />
                </Sample>
              }
            />
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hair pt-3 text-xs text-soft">
          <span className="font-semibold text-ink">En el mapa:</span>
          <span className="flex items-center gap-2">
            <span
              className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow ring-2 ring-warning"
              style={{ backgroundColor: SAMPLE_COLOR }}
            >
              1
              <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full border border-white bg-warning text-[7px] font-black">
                !
              </span>
            </span>
            Aro y «!»: sin confirmar
          </span>
          {client.features.rugPickup && (
            <span className="flex items-center gap-2">
              <span
                className="flex h-4 w-4 rotate-45 items-center justify-center rounded-[3px] border-2 border-white shadow"
                style={{ backgroundColor: SAMPLE_COLOR }}
              />
              Rombo: entrega
            </span>
          )}
          <span>El número es el orden de la ruta del técnico.</span>
        </div>
      </LegendDisclosure>
    </section>
  );
}
