import { avatarTone } from "@/domain/customer-rules";
import { initialsOf } from "@/domain/calendar-view";
import { AVATAR_CLASSES } from "@/lib/ui";

export function CustomerAvatar({ name, seed, size = "md" }: { name: string; seed: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`font-display flex shrink-0 items-center justify-center rounded-md font-semibold ${
        AVATAR_CLASSES[avatarTone(seed)]
      } ${size === "lg" ? "h-[72px] w-[72px] text-2xl" : "h-11 w-11 text-sm"}`}
    >
      {initialsOf(name)}
    </span>
  );
}
