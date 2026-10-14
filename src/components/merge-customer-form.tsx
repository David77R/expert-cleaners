"use client";

import { useActionState } from "react";
import { mergeCustomerAction, type MergeState } from "@/app/customers/[id]/actions";
import { INPUT } from "@/components/form-kit";

type Candidate = { id: string; code: string; firstName: string; lastName: string };

export function MergeCustomerForm({
  customerId,
  customerCode,
  candidates,
}: {
  customerId: string;
  customerCode: string;
  candidates: Candidate[];
}) {
  const [state, action, pending] = useActionState(mergeCustomerAction.bind(null, customerId), {} as MergeState);

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-hair px-4 py-4">
      <p className="text-sm text-soft">
        Todo lo de {customerCode} (citas, direcciones y notas) pasa al cliente que elijas, y {customerCode} se elimina.
      </p>
      {candidates.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Posibles repetidos</legend>
          {candidates.map((candidate) => (
            <label
              key={candidate.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-hair px-3 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40"
            >
              <input type="radio" name="targetId" value={candidate.id} className="accent-brand" />
              <span>
                {candidate.firstName} {candidate.lastName}
                <span className="ml-1.5 text-xs text-muted">{candidate.code}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <label htmlFor="merge-target-code" className="flex flex-col gap-1.5 text-sm font-medium">
        {candidates.length > 0 ? "O escribe el código del cliente que se queda" : "Código del cliente que se queda"}
        <input id="merge-target-code" name="targetCode" placeholder="CLI-1001" className={INPUT} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-attention">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md border border-attention/50 bg-paper px-4 py-2 text-sm font-semibold text-attention transition-colors hover:bg-attention-soft disabled:opacity-60"
      >
        {pending ? "Uniendo…" : "Unir y eliminar " + customerCode}
      </button>
    </form>
  );
}
