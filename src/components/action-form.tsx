"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/calendar/actions";

const TONES = {
  primary: "bg-brand text-white hover:opacity-90",
  secondary: "border border-hair bg-paper text-ink hover:bg-canvas",
  danger: "border border-attention/50 bg-paper text-attention hover:bg-attention-soft",
} as const;

export function ActionForm({
  action,
  submit,
  pendingText,
  tone = "secondary",
  children,
  className = "",
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  submit: string;
  pendingText: string;
  tone?: keyof typeof TONES;
  children?: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { stamp: 0 });

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <form key={state.stamp} action={formAction} className="flex flex-col gap-3">
        {children}
        <button
          type="submit"
          disabled={pending}
          className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${TONES[tone]}`}
        >
          {pending ? pendingText : submit}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-sm font-medium text-attention">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className="text-sm font-medium text-warning">
          {state.notice}
        </p>
      )}
    </div>
  );
}
