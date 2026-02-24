"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useUnreadMenuCounts } from "@/lib/api/hooks";

const MENU_KEY_BY_PREFIX: Array<{ prefix: string; key: string; label: string }> = [
  { prefix: "/hub", key: "hub", label: "허브" },
  { prefix: "/calendar", key: "calendar", label: "캘린더" },
  { prefix: "/todos", key: "todos", label: "To-Do" },
  { prefix: "/memos", key: "memos", label: "메모" },
  { prefix: "/expenses", key: "expenses", label: "경비 청구" },
  { prefix: "/utilities", key: "utilities", label: "공과금" },
  { prefix: "/tax-invoices", key: "tax_invoices", label: "세금계산서" },
  { prefix: "/bank-transactions", key: "bank_transactions", label: "입출금" },
  { prefix: "/vault", key: "vault", label: "계정 공유" },
  { prefix: "/settings", key: "settings", label: "설정" },
];

export function MenuReadTracker() {
  const pathname = usePathname();
  const { data: unreadCounts } = useUnreadMenuCounts();
  const previousCountsRef = useRef<Map<string, number> | null>(null);

  const resolvedMenu = useMemo(() => {
    return MENU_KEY_BY_PREFIX.find((item) => pathname.startsWith(item.prefix));
  }, [pathname]);

  useEffect(() => {
    if (!resolvedMenu) return;
    void markMenuAsRead(resolvedMenu.key);
  }, [resolvedMenu]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!unreadCounts || unreadCounts.length === 0) return;

    const nextMap = new Map(unreadCounts.map((item) => [item.key, item.count]));
    const prevMap = previousCountsRef.current;

    if (prevMap && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      const increased = unreadCounts.filter((item) => item.count > (prevMap.get(item.key) ?? 0));
      if (increased.length > 0 && document.hidden) {
        const first = MENU_KEY_BY_PREFIX.find((item) => item.key === increased[0].key);
        const title = first ? `${first.label} 새 알림` : "새 알림";
        const body = `${increased.reduce((sum, item) => sum + item.count, 0)}개의 읽지 않은 항목이 있습니다.`;
        new Notification(title, { body });
      }
    }

    previousCountsRef.current = nextMap;
  }, [unreadCounts]);

  return null;
}
