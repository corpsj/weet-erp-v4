import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "brand" | "warning" | "danger";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-[rgb(42_42_42/70%)] text-[var(--color-ink-muted)]",
  brand: "bg-[rgb(212_212_212/16%)] text-[var(--color-brand)]",
  warning: "bg-[rgb(229_229_229/15%)] text-[var(--color-warning)]",
  danger: "bg-[rgb(255_77_109/15%)] text-[var(--color-danger)]",
};

export function Badge({
  className,
  children,
  tone = "neutral",
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
