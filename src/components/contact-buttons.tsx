"use client";

import { useState } from "react";
import { customerContactHref } from "@/app/customers/contact-actions";
import { Icon } from "@/components/icons";
import type { ContactChannel } from "@/domain/phone-privacy";

const WHATSAPP_PATH =
  "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z";

export function ContactButton({
  customerId,
  channel,
  text,
  label,
  className,
}: {
  customerId: string;
  channel: ContactChannel;
  text?: string;
  label?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setError(null);
    setPending(true);
    const popup = channel === "whatsapp" ? window.open("", "_blank") : null;
    const result = await customerContactHref(customerId, channel, text);
    setPending(false);
    if (!result.ok) {
      popup?.close();
      setError(result.message);
      return;
    }
    if (popup) {
      popup.opener = null;
      popup.location.href = result.href;
    } else {
      window.location.href = result.href;
    }
  }

  const base =
    channel === "whatsapp"
      ? "bg-[#25D366] text-white hover:opacity-90"
      : "border border-hair bg-paper text-ink hover:bg-canvas";

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={
          className ??
          `flex min-h-10 items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-opacity disabled:opacity-60 ${base}`
        }
      >
        {channel === "whatsapp" ? (
          <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
            <path fill="currentColor" d={WHATSAPP_PATH} />
          </svg>
        ) : (
          <Icon name="phone" size={16} />
        )}
        {pending ? "Abriendo…" : (label ?? (channel === "whatsapp" ? "WhatsApp" : "Llamar"))}
      </button>
      {error && (
        <span role="alert" className="text-xs text-attention">
          {error}
        </span>
      )}
    </span>
  );
}

export function ContactButtons({ customerId, className = "" }: { customerId: string; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <ContactButton customerId={customerId} channel="call" />
      <ContactButton customerId={customerId} channel="whatsapp" />
    </div>
  );
}
