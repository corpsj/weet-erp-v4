"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NAV_GROUPS, MARKETING_NAV_GROUPS } from "@/lib/navigation";
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
  const isMarketing = pathname.startsWith("/marketing");
  const { data } = useUnreadMenuCounts();

  const unreadMap = useMemo(() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((entry) => {
      map.set(entry.key, entry.count);
    });
    return map;
  }, [data]);

  const navGroups = isMarketing ? MARKETING_NAV_GROUPS : NAV_GROUPS;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 82 : 280 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex h-full flex-col border-r border-[#2a2a2a] bg-[#0a0a0a] px-3 py-4 overflow-hidden"
    >
      <div className="mb-5 flex h-9 items-center gap-2 px-2 shrink-0">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e5e5e5] text-sm font-bold text-[#0a0a0a]">
          WE
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap overflow-hidden"
            >
              <p className="display-font text-lg font-semibold leading-none">
                {isMarketing ? "WEET Director" : "ERP v4"}
              </p>
              <p className="text-xs text-[#9a9a9a] mt-1 leading-none">
                {isMarketing ? "AI Marketing" : "Grok UX"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-4 overflow-y-auto pb-4 overflow-x-hidden">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col">
            <AnimatePresence initial={false}>
              {!collapsed ? (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 px-2 text-[11px] uppercase tracking-[0.15em] text-[#9a9a9a] whitespace-nowrap overflow-hidden"
                >
                  {group.label}
                </motion.p>
              ) : (
                <div className="h-2" />
              )}
            </AnimatePresence>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const unread = isMarketing ? 0 : (unreadMap.get(item.key) ?? 0);

                return (
                  <li key={item.key}>
                    <Link
                      href={item.disabled ? "#" : item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group flex h-9 items-center rounded-lg px-2 text-sm transition-colors",
                        active
                          ? "bg-[#1a1a1a] text-[#ffffff] border-l-2 border-[#ffffff]"
                          : "text-[#9a9a9a] hover:bg-[#141414] hover:text-[#ffffff] border-l-2 border-transparent",
                        item.disabled && "pointer-events-none opacity-45",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <AnimatePresence initial={false}>
                        {!collapsed && (
                          <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: "auto" }}
                            exit={{ opacity: 0, width: 0 }}
                            className="ml-3 flex-1 flex items-center overflow-hidden whitespace-nowrap"
                          >
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.disabled ? (
                              <span className="ml-2 rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-[#e5e5e5]">
                                준비중
                              </span>
                            ) : unread > 0 ? (
                              <span className="ml-2 rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-[#d4d4d4]">
                                {unread}
                              </span>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto shrink-0 space-y-2 border-t border-[#2a2a2a] pt-4 overflow-hidden">
        {isMarketing ? (
          <Link
            href="/hub"
            className="flex h-9 items-center rounded-lg px-2 text-sm text-[#9a9a9a] transition-colors hover:bg-[#141414] hover:text-[#ffffff] border-l-2 border-transparent"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-3 whitespace-nowrap overflow-hidden"
                >
                  ERP로 돌아가기
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ) : (
          <Link
            href="/settings"
            className="flex h-9 items-center rounded-lg px-2 text-sm text-[#9a9a9a] transition-colors hover:bg-[#141414] hover:text-[#ffffff] border-l-2 border-transparent"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="ml-3 whitespace-nowrap overflow-hidden"
                >
                  설정
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}

        <div className="flex h-12 items-center rounded-xl border border-[#2a2a2a] bg-[#141414] px-2 py-2">
          <div className="h-8 w-8 shrink-0 rounded-full bg-[#1a1a1a] border border-[#3a3a3a]" />
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="ml-2 flex flex-col overflow-hidden whitespace-nowrap"
              >
                <p className="truncate text-sm text-[#ffffff] leading-tight">{username}</p>
                <p className="text-[10px] text-[#9a9a9a] leading-tight">{role === "admin" ? "관리자" : "일반 사용자"}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
