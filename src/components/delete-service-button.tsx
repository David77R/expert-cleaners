"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteServiceAction } from "@/app/services/actions";
import { Icon } from "@/components/icons";
import { Modal } from "@/components/modal";

export function DeleteServiceButton({
  serviceId,
  serviceName,
  back = "orders",
  variant = "button",
}: {
  serviceId: string;
  serviceName: string;
  back?: "orders" | "services";
  variant?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteServiceAction(serviceId, back);
      if (result?.error) setError(result.error);
    });
  }

  function close() {
    if (!pending) setOpen(false);
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Eliminar ${serviceName}`}
          title="Eliminar servicio"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-paper/90 text-attention shadow-sm hover:bg-attention-soft"
        >
          <Icon name="trash" size={13} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-md border border-attention/40 px-4 py-2.5 text-sm font-semibold text-attention hover:bg-attention-soft"
        >
          <Icon name="trash" size={14} />
          Eliminar servicio
        </button>
      )}
      {open &&
        createPortal(
          <Modal title="Eliminar servicio" onClose={close}>
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                ¿Eliminar <strong>{serviceName}</strong>? Desaparece de Nuevo pedido, de Servicios y de los formularios.
              </p>
              <p className="rounded-md bg-canvas px-3 py-2.5 text-sm text-soft">
                Si ya se usó en citas, esas citas lo conservan con su precio e historial; solo deja de ofrecerse.
              </p>
              {error && (
                <p role="alert" className="rounded-md bg-attention-soft px-3 py-2.5 text-sm text-attention">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={pending}
                  className="rounded-md px-4 py-2.5 text-sm font-semibold text-soft hover:bg-canvas"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={pending}
                  className="flex items-center gap-2 rounded-md bg-attention px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Icon name="trash" size={14} />
                  {pending ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </Modal>,
          document.body,
        )}
    </>
  );
}
