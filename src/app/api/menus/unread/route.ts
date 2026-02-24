import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

const menuSourceMap: Record<string, string> = {
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

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const menuKeys = Object.keys(menuSourceMap);
    const { data: reads } = await supabase
      .from("user_menu_reads")
      .select("menu_key, last_read_at")
      .eq("user_id", user.id)
      .in("menu_key", menuKeys);

    const lastReadMap = new Map((reads ?? []).map((entry) => [entry.menu_key, entry.last_read_at]));

    const counts = await Promise.all(
      menuKeys.map(async (menuKey) => {
        const table = menuSourceMap[menuKey];
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

    return ok(counts);
  } catch (error) {
    return toErrorResponse(error);
  }
}
