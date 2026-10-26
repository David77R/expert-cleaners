import { z } from "zod";

export type ChecklistGroup = { title: string; items: string[] };
export type ChecklistProgress = Record<string, { at: string; by: string }>;

export const MAX_CHECKLIST_TASKS = 60;
const MAX_TASK_LENGTH = 160;

export const checklistSchema = z
  .array(
    z.object({
      title: z.string().trim().max(80),
      items: z.array(z.string().trim().min(1).max(MAX_TASK_LENGTH)).min(1),
    }),
  )
  .refine(
    (groups) => groups.reduce((sum, group) => sum + group.items.length, 0) <= MAX_CHECKLIST_TASKS,
    `Máximo ${MAX_CHECKLIST_TASKS} tareas por servicio`,
  );

export function parseChecklist(text: string): ChecklistGroup[] {
  const groups: ChecklistGroup[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    if (line.startsWith("#")) {
      groups.push({ title: line.replace(/^#+/, "").trim(), items: [] });
      continue;
    }
    const task = line.replace(/^[-*•]\s*/, "").slice(0, MAX_TASK_LENGTH);
    if (task === "") continue;
    if (groups.length === 0) groups.push({ title: "", items: [] });
    const group = groups[groups.length - 1];
    if (!group.items.includes(task)) group.items.push(task);
  }
  return groups.filter((group) => group.items.length > 0);
}

export function checklistText(groups: readonly ChecklistGroup[]): string {
  return groups.map((group) => [...(group.title ? [`# ${group.title}`] : []), ...group.items].join("\n")).join("\n\n");
}

export function checklistTasks(groups: readonly ChecklistGroup[]): string[] {
  return [...new Set(groups.flatMap((group) => group.items))];
}

export function checklistProgress(groups: readonly ChecklistGroup[], done: ChecklistProgress) {
  const tasks = checklistTasks(groups);
  const completed = tasks.filter((task) => done[task]).length;
  return { total: tasks.length, completed, finished: tasks.length > 0 && completed === tasks.length };
}

export const DAMAGE_KINDS = {
  scratch: "Rayón",
  dent: "Golpe o abolladura",
  chip: "Pintura saltada",
  glass: "Vidrio rajado",
  wheel: "Rin o llanta",
  stain: "Mancha o daño interior",
  other: "Otro",
} as const;

export type DamageKind = keyof typeof DAMAGE_KINDS;

export const INSPECTION_ANGLES = {
  front: "Frente",
  back: "Atrás",
  left: "Lado del chofer",
  right: "Lado del pasajero",
  interior: "Interior",
  dashboard: "Tablero y millaje",
} as const;

export type InspectionAngle = keyof typeof INSPECTION_ANGLES;

export function isInspectionAngle(value: string): value is InspectionAngle {
  return value in INSPECTION_ANGLES;
}

export const MAX_DAMAGE_MARKS = 40;

const coordinate = z.number().min(0).max(100);

export const damageMarkSchema = z.object({
  x: coordinate,
  y: coordinate,
  kind: z.enum(Object.keys(DAMAGE_KINDS) as [DamageKind, ...DamageKind[]]),
  note: z.string().trim().max(120).default(""),
});

export type DamageMark = z.output<typeof damageMarkSchema>;

export type Inspection = { marks: DamageMark[]; notes: string; at: string; by: string };

export const inspectionInputSchema = z.object({
  itemId: z.uuid(),
  marks: z.array(damageMarkSchema).max(MAX_DAMAGE_MARKS, `Máximo ${MAX_DAMAGE_MARKS} marcas`),
  notes: z.string().trim().max(500).default(""),
});

export const checklistToggleSchema = z.object({
  itemId: z.uuid(),
  task: z.string().trim().min(1).max(MAX_TASK_LENGTH),
  done: z.boolean(),
});

export function inspectionSummary(inspection: Inspection | null, photoAngles: readonly string[]) {
  const angles = Object.keys(INSPECTION_ANGLES).filter((angle) => photoAngles.includes(angle)).length;
  return {
    done: inspection !== null,
    marks: inspection?.marks.length ?? 0,
    photos: angles,
    totalPhotos: Object.keys(INSPECTION_ANGLES).length,
  };
}
