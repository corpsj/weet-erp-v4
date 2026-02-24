"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api/client";
import type { UnreadMenuCount } from "@/types/api";

export * from "@/lib/api/hooks/calendar";
export * from "@/lib/api/hooks/bank-transactions";
export * from "@/lib/api/hooks/expenses";
export * from "@/lib/api/hooks/hub";
export * from "@/lib/api/hooks/memos";
export * from "@/lib/api/hooks/tax-invoices";
export * from "@/lib/api/hooks/todos";
export * from "@/lib/api/hooks/utilities";
export * from "@/lib/api/hooks/users";
export * from "@/lib/api/hooks/settings";
export * from "@/lib/api/hooks/vault";

export function useUnreadMenuCounts() {
  return useQuery({
    queryKey: ["menu-unread-counts"],
    queryFn: () => fetchApi<UnreadMenuCount[]>("/api/menus/unread"),
    refetchInterval: 1000 * 45,
    refetchIntervalInBackground: true,
  });
}
