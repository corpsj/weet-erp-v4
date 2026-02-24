"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed inset-x-2 bottom-2 z-40 grid h-16 grid-cols-5 rounded-2xl border md:hidden">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            href={item.href}
            key={item.key}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium",
              active ? "text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
