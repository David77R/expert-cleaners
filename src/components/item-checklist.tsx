"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleTaskAction } from "@/app/appointments/[id]/trabajo/actions";
import { Icon } from "@/components/icons";
import { checklistProgress, type ChecklistGroup, type ChecklistProgress } from "@/domain/vehicle-care";

export function ItemChecklist({
  appointmentId,
  itemId,
  groups,
  done,
  editable,
}: {
  appointmentId: string;
  itemId: string;
  groups: ChecklistGroup[];
  done: ChecklistProgress;
  editable: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    done,
    (state: ChecklistProgress, change: { task: string; done: boolean }) => {
      const next = { ...state };
      if (change.done) next[change.task] = { at: new Date().toISOString(), by: "" };
      else delete next[change.task];
      return next;
    },
  );
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const progress = checklistProgress(groups, optimistic);
  const percent = progress.total === 0 ? 0 : Math.round((progress.completed / progress.total) * 100);

  function toggle(task: string, value: boolean) {
    setError(null);
    startTransition(async () => {
      setOptimistic({ task, done: value });
      const result = await toggleTaskAction(appointmentId, itemId, task, value);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.completed}
          aria-label="Avance del checklist"
        >
          <div
            className={`h-full rounded-full transition-[width] ${progress.finished ? "bg-success" : "bg-brand"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="font-display shrink-0 text-sm font-semibold tabular-nums">
          {progress.completed}/{progress.total}
        </span>
      </div>
      {progress.finished && (
        <p className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm font-semibold text-success">
          <Icon name="check" size={16} /> Checklist completo
        </p>
      )}
      {groups.map((group, index) => (
        <fieldset key={`${group.title}-${index}`} className="flex flex-col gap-1">
          {group.title && (
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-soft">{group.title}</legend>
          )}
          {group.items.map((task) => {
            const checked = Boolean(optimistic[task]);
            const who = done[task];
            return (
              <label
                key={task}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  checked ? "bg-success-soft/60" : "hover:bg-canvas"
                } ${editable ? "" : "cursor-default"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!editable}
                  onChange={(event) => toggle(task, event.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-hair accent-success"
                />
                <span className="min-w-0 text-[15px] leading-snug">
                  <span className={checked ? "text-soft line-through decoration-success/60" : ""}>{task}</span>
                  {checked && who?.by && <span className="mt-0.5 block text-xs text-muted">{who.by}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
      {error && (
        <p role="alert" className="text-sm font-medium text-attention">
          {error}
        </p>
      )}
    </div>
  );
}
