"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";
import { motion } from "framer-motion";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-[#2a2a2a] bg-[#0a0a0a] px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            href={item.href}
            key={item.key}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1.5 text-[10px] font-medium transition-colors",
              active ? "text-[#ffffff]" : "text-[#9a9a9a] hover:text-[#d4d4d4]",
            )}
          >
            {active && (
              <motion.div
                layoutId="mobile-nav-indicator"
                className="absolute top-0 h-0.5 w-8 rounded-b-full bg-[#ffffff]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
            <span className="leading-none tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
