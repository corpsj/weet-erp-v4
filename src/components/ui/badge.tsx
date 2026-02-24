import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeTone = "neutral" | "brand" | "warning" | "danger";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-[#1a1a1a] border border-[#2a2a2a] text-[#9a9a9a]",
  brand: "bg-[#e5e5e5] text-[#0a0a0a]",
  warning: "bg-[#141414] border border-[#3a3a3a] text-[#d4d4d4]",
  danger: "bg-[#ff4d6d] text-[#ffffff]",
};

export function Badge({
  className,
  children,
  tone = "neutral",
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2.5 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
