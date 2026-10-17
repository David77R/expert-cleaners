"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { moveAppointmentAction } from "@/app/calendar/actions";
import { announce } from "@/components/calendar-notice";
import { formatMinutes } from "@/domain/appointment-rules";
import { laneAt, dropStartMinutes, isSameSlot } from "@/domain/drag-target";
import { END_HOUR, HOUR_PX, START_HOUR, toPx } from "@/lib/day-grid";

type Slot = { startMin: number; technicianId: string };
type Preview = Slot & { left: number; width: number; top: number };

const DRAG_THRESHOLD_PX = 6;
const LONG_PRESS_MS = 380;
const TOUCH_SLOP_PX = 10;
const EDGE_PX = 44;
const MAX_SCROLL_STEP_PX = 7;
const TOP_BAR_PX = 60;
const BOTTOM_BAR_PX = 76;

function edgeSpeed(distanceIntoEdge: number): number {
  if (distanceIntoEdge <= 0) return 0;
  return Math.ceil(MAX_SCROLL_STEP_PX * Math.min(1, distanceIntoEdge / EDGE_PX));
}

export function DragTicket({
  appointmentId,
  code,
  serviceName,
  startMin,
  durationMin,
  technicianId,
  technicians,
  draggable,
  className,
  style,
  children,
  startHour = START_HOUR,
  endHour = END_HOUR,
}: {
  appointmentId: string;
  code: string;
  serviceName: string;
  startMin: number;
  durationMin: number;
  technicianId: string;
  technicians: { id: string; name: string }[];
  draggable: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  startHour?: number;
  endHour?: number;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const session = useRef<{ cancel: () => void; stop: () => void } | null>(null);
  const suppressClick = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const touchDragging = useRef(false);
  const lastPointer = useRef("mouse");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current: Slot = { startMin, technicianId };
  const isOpen = pending !== null;
  const nameOf = (id: string) => technicians.find((technician) => technician.id === id)?.name ?? "—";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const dragging = preview !== null;
  useEffect(() => {
    if (!dragging) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      session.current?.cancel();
      setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.cursor = "grabbing";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.cursor = "";
    };
  }, [dragging]);

  useEffect(() => () => session.current?.stop(), []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    function block(event: TouchEvent) {
      if (touchDragging.current) event.preventDefault();
    }
    node.addEventListener("touchmove", block, { passive: false });
    return () => node.removeEventListener("touchmove", block);
  }, []);

  function locate(clientX: number, clientY: number, grabMin: number): Preview | null {
    const lanes = [...document.querySelectorAll<HTMLElement>("[data-lane]")].map((element) => {
      const box = element.getBoundingClientRect();
      return { id: element.dataset.lane ?? "", left: box.left, right: box.right, top: box.top, width: box.width };
    });
    const id = laneAt(clientX, lanes);
    const lane = lanes.find((candidate) => candidate.id === id);
    if (!lane) return null;
    const start = dropStartMinutes({
      pointerOffsetPx: clientY - lane.top,
      grabOffsetMin: grabMin,
      durationMin,
      startHour,
      endHour,
      hourPx: HOUR_PX,
    });
    return {
      technicianId: lane.id,
      startMin: start,
      left: lane.left,
      width: lane.width,
      top: lane.top + toPx(start, startHour),
    };
  }

  function propose(target: Preview | null) {
    setPreview(null);
    if (target && !isSameSlot(current, target)) {
      setError(null);
      setPending({ startMin: target.startMin, technicianId: target.technicianId });
    }
  }

  function onTouchPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    session.current?.stop();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const grabMin = ((event.clientY - event.currentTarget.getBoundingClientRect().top) / HOUR_PX) * 60;
    const scroller = event.currentTarget.closest<HTMLElement>("[data-grid-scroll]");
    let lastX = startX;
    let lastY = startY;
    let active = false;
    let frame = 0;

    function autoScroll() {
      if (!active) return;
      let moved = false;
      if (scroller) {
        const box = scroller.getBoundingClientRect();
        const left = edgeSpeed(box.left + EDGE_PX - lastX);
        const right = edgeSpeed(lastX - (box.right - EDGE_PX));
        const maxLeft = scroller.scrollWidth - scroller.clientWidth;
        if (left > 0 && scroller.scrollLeft > 0) {
          scroller.scrollLeft -= left;
          moved = true;
        } else if (right > 0 && scroller.scrollLeft < maxLeft) {
          scroller.scrollLeft += right;
          moved = true;
        }
        const bottomLimit = window.innerHeight - BOTTOM_BAR_PX;
        const up = edgeSpeed(TOP_BAR_PX + EDGE_PX - lastY);
        const down = edgeSpeed(lastY - (bottomLimit - EDGE_PX));
        if (up > 0 && box.top < TOP_BAR_PX) {
          window.scrollBy(0, -up);
          moved = true;
        } else if (down > 0 && box.bottom > bottomLimit) {
          window.scrollBy(0, down);
          moved = true;
        }
      }
      if (moved) setPreview(locate(lastX, lastY, grabMin));
      frame = requestAnimationFrame(autoScroll);
    }

    const timer = setTimeout(() => {
      active = true;
      touchDragging.current = true;
      navigator.vibrate?.(15);
      setPreview(locate(lastX, lastY, grabMin));
      frame = requestAnimationFrame(autoScroll);
    }, LONG_PRESS_MS);

    function stop() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      touchDragging.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      session.current = null;
    }

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      if (!active) {
        if (Math.hypot(lastX - startX, lastY - startY) > TOUCH_SLOP_PX) stop();
        return;
      }
      setPreview(locate(lastX, lastY, grabMin));
    }

    function end(endEvent: PointerEvent, commit: boolean) {
      if (endEvent.pointerId !== pointerId) return;
      const wasActive = active;
      active = false;
      stop();
      if (!wasActive) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 400);
      propose(commit ? locate(lastX, lastY, grabMin) : null);
    }

    function onUp(upEvent: PointerEvent) {
      end(upEvent, true);
    }

    function onCancel(cancelEvent: PointerEvent) {
      end(cancelEvent, false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    session.current = {
      stop,
      cancel: () => {
        active = false;
        stop();
        setPreview(null);
      },
    };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    lastPointer.current = event.pointerType;
    if (!draggable) return;
    if (event.pointerType !== "mouse") {
      onTouchPointerDown(event);
      return;
    }
    if (event.button !== 0) return;
    session.current?.stop();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const grabMin = ((event.clientY - event.currentTarget.getBoundingClientRect().top) / HOUR_PX) * 60;
    let active = false;
    let cancelled = false;

    function stop() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      session.current = null;
    }

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId || cancelled) return;
      if (!active) {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < DRAG_THRESHOLD_PX) return;
        active = true;
      }
      setPreview(locate(moveEvent.clientX, moveEvent.clientY, grabMin));
    }

    function end(endEvent: PointerEvent, commit: boolean) {
      if (endEvent.pointerId !== pointerId) return;
      stop();
      if (!active) return;
      suppressClick.current = true;
      setTimeout(() => (suppressClick.current = false), 0);
      propose(commit && !cancelled ? locate(endEvent.clientX, endEvent.clientY, grabMin) : null);
    }

    function onUp(upEvent: PointerEvent) {
      end(upEvent, true);
    }

    function onCancel(cancelEvent: PointerEvent) {
      end(cancelEvent, false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    session.current = {
      stop,
      cancel: () => {
        cancelled = true;
      },
    };
  }

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await moveAppointmentAction(appointmentId, pending.startMin, pending.technicianId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const url = new URL(window.location.href);
      const filtered = url.searchParams.has("estado");
      announce({
        text: `${result.notice ?? "Cita movida."}${filtered ? " Se quitó el filtro para que la veas en su nuevo lugar." : ""}`,
        tone: result.notice ? "warning" : "success",
      });
      setPending(null);
      if (filtered) {
        url.searchParams.delete("estado");
        router.replace(`${url.pathname}${url.search}`, { scroll: false });
      }
    } catch {
      setError("No se pudo mover la cita. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={root}
      className={`${className ?? ""} ${draggable ? "cursor-grab select-none [-webkit-touch-callout:none]" : ""} ${
        dragging ? "opacity-40" : ""
      }`}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={(event) => {
        if (draggable && lastPointer.current !== "mouse") event.preventDefault();
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}

      {preview && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[70] rounded-md border-2 border-dashed border-brand bg-brand/15"
          style={{
            left: preview.left + 4,
            width: preview.width - 8,
            top: preview.top,
            height: Math.max((durationMin / 60) * HOUR_PX, 30),
          }}
        >
          <span className="font-display m-1 inline-block rounded-[3px] bg-brand px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {formatMinutes(preview.startMin)} · {nameOf(preview.technicianId)}
          </span>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-label="Confirmar movimiento de la cita"
        onClose={() => setPending(null)}
        className="m-auto w-[min(92vw,26rem)] cursor-default rounded-lg border border-hair bg-paper p-0 text-ink backdrop:bg-ink/60"
      >
        {pending && (
          <div className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="font-display text-lg font-semibold">¿Mover esta cita?</h2>
              <p className="mt-0.5 text-sm text-soft">
                {code} · {serviceName}
              </p>
            </div>
            <dl className="flex flex-col gap-2 rounded-md bg-canvas px-3.5 py-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-soft">Ahora</dt>
                <dd className="text-right font-medium">
                  {formatMinutes(startMin)} · {nameOf(technicianId)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-soft">Nuevo</dt>
                <dd className="text-right font-semibold text-brand-ink">
                  {formatMinutes(pending.startMin)} · {nameOf(pending.technicianId)}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-soft">
              Si choca con otra cita, se mueve igual y se marca en conflicto. Queda registrado en el historial.
            </p>
            {error && (
              <p role="alert" className="text-sm font-medium text-attention">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPending(null)}
                className="rounded-md px-4 py-2 text-sm font-semibold text-soft hover:bg-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {busy ? "Moviendo…" : "Mover cita"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
