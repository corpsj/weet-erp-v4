"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { NAV_GROUPS } from "@/lib/navigation";
import { useUnreadMenuCounts } from "@/lib/api/hooks";
import { cn } from "@/lib/utils/cn";

type SidebarProps = {
  collapsed: boolean;
  onNavigate?: () => void;
  username: string;
  role: string;
};

export function Sidebar({ collapsed, onNavigate, username, role }: SidebarProps) {
  const pathname = usePathname();
  const { data } = useUnreadMenuCounts();

  const unreadMap = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((entry) => {
      map.set(entry.key, entry.count);
    });
    return map;
  }, [data]);

  return (
    <aside
      className={cn(
        "glass flex h-full flex-col border-r border-[rgb(42_42_42/50%)] px-3 py-4 transition-all duration-300",
        collapsed ? "w-[82px]" : "w-[280px]",
      )}
    >
      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5e5e5] text-sm font-bold text-[#0a0a0a]">
          WE
        </div>
        {!collapsed && (
          <div>
            <p className="display-font text-lg font-semibold">ERP v4</p>
            <p className="text-xs text-[var(--color-ink-muted)]">Grok UX</p>
          </div>
        )}
      </div>

      <div className="space-y-4 overflow-y-auto pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="mb-2 px-2 text-[11px] uppercase tracking-[0.15em] text-[var(--color-ink-muted)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const unread = unreadMap.get(item.key) ?? 0;

                return (
                  <li key={item.key}>
                    <Link
                      href={item.disabled ? "#" : item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex h-11 items-center rounded-xl border px-3 text-sm transition",
                        active
                          ? "border-[rgb(212_212_212/30%)] bg-[rgb(26_26_26/80%)] text-[var(--color-brand)]"
                          : "border-transparent text-[var(--color-ink-muted)] hover:border-[rgb(42_42_42/55%)] hover:bg-[rgb(26_26_26/70%)] hover:text-[var(--color-ink)]",
                        item.disabled && "pointer-events-none opacity-45",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="ml-3 flex-1">{item.label}</span>
                          {item.disabled ? (
                            <span className="rounded-full bg-[rgb(229_229_229/12%)] px-2 py-0.5 text-[10px] text-[var(--color-warning)]">
                              준비중
                            </span>
                          ) : unread > 0 ? (
                            <span className="rounded-full bg-[rgb(212_212_212/18%)] px-2 py-0.5 text-[10px] text-[var(--color-brand)]">
                              {unread}
                            </span>
                          ) : null}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto space-y-2 border-t border-[rgb(42_42_42/50%)] pt-4">
        <Link
          href="/settings"
          className="flex h-10 items-center rounded-xl px-3 text-sm text-[var(--color-ink-muted)] transition hover:bg-[rgb(26_26_26/70%)] hover:text-[var(--color-ink)]"
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span className="ml-3">설정</span>}
        </Link>

        <div className="rounded-xl border border-[rgb(42_42_42/55%)] bg-[rgb(20_20_20/65%)] px-3 py-2">
          <p className="truncate text-sm text-[var(--color-ink)]">{username}</p>
          {!collapsed && <p className="text-xs text-[var(--color-ink-muted)]">{role === "admin" ? "관리자" : "일반 사용자"}</p>}
        </div>
      </div>
    </aside>
  );
}
