"use server";

import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { UnreadMenuCount } from "@/types/api";

export const MENU_SOURCE_MAP: Record<string, string> = {
  hub: "todos",
  calendar: "calendar_events",
  todos: "todos",
  memos: "memos",
  expenses: "expense_claims",
  utilities: "utility_bills",
  tax_invoices: "tax_invoices",
  bank_transactions: "bank_transactions",
  vault: "vault_entries",
  settings: "app_users",
};

export async function getUnreadMenuCountsAction(): Promise<ActionResult<UnreadMenuCount[]>> {
  try {
    const { supabase, user } = await getActionContext();
    const menuKeys = Object.keys(MENU_SOURCE_MAP);

    const { data: reads } = await supabase
      .from("user_menu_reads")
      .select("menu_key, last_read_at")
      .eq("user_id", user.id)
      .in("menu_key", menuKeys);

    const lastReadMap = new Map((reads ?? []).map((entry) => [entry.menu_key, entry.last_read_at]));

    const counts = await Promise.all(
      menuKeys.map(async (menuKey) => {
        const table = MENU_SOURCE_MAP[menuKey];
        const readAt = lastReadMap.get(menuKey);
        let query = supabase.from(table).select("id", { count: "exact", head: true });

        if (readAt) {
          query = query.gt("created_at", readAt);
        }

        const { count } = await query;
        return {
          key: menuKey,
          count: count ?? 0,
        };
      }),
    );

    return actionSuccess(counts);
  } catch {
    return actionError("읽지 않은 항목 수를 불러오지 못했습니다.");
  }
}
