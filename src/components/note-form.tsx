"use client";

import { useActionState } from "react";
import { addNote, type NoteState } from "@/app/customers/[id]/actions";

export function NoteForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(addNote.bind(null, customerId), { version: 0 } as NoteState);

  return (
    <form key={state.version} action={action} className="flex flex-col gap-2">
      <label htmlFor="note-text" className="text-sm font-medium">
        Agregar una nota
      </label>
      <textarea
        id="note-text"
        name="text"
        rows={3}
        maxLength={2000}
        required
        placeholder="Ej: prefiere que llamen antes de llegar, hay un perro en el patio…"
        className="w-full resize-y rounded-md border border-hair bg-paper px-3.5 py-2.5 text-sm placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {state.error && (
        <p role="alert" className="text-sm text-attention">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar nota"}
      </button>
    </form>
  );
}
