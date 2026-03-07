"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";

const HUB_MENU_KEYS = [
  "hub",
  "calendar",
  "todos",
  "memos",
  "expenses",
  "utilities",
  "tax_invoices",
  "bank_transactions",
  "vault",
  "marketing",
] as const;

const menuKeySchema = z.enum(HUB_MENU_KEYS);

export async function markAllMenusAsRead(): Promise<ActionResult> {
  try {
    const { supabase, user } = await getActionContext();
    const now = new Date().toISOString();
    const payload = HUB_MENU_KEYS.map((menuKey) => ({
      user_id: user.id,
      menu_key: menuKey,
      last_read_at: now,
    }));

    const { error } = await supabase
      .from("user_menu_reads")
      .upsert(payload, { onConflict: "user_id,menu_key" });

    if (error) {
      return actionError("읽음 처리에 실패했습니다.");
    }

    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("읽음 처리 중 오류가 발생했습니다.");
  }
}

export async function markMenuAsRead(menuKey: string): Promise<ActionResult> {
  const parsed = menuKeySchema.safeParse(menuKey);
  if (!parsed.success) {
    return actionError("유효하지 않은 메뉴 키입니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { error } = await supabase.from("user_menu_reads").upsert(
      {
        user_id: user.id,
        menu_key: parsed.data,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "user_id,menu_key" },
    );

    if (error) {
      return actionError("읽음 처리에 실패했습니다.");
    }

    return actionSuccess(undefined);
  } catch {
    return actionError("읽음 처리 중 오류가 발생했습니다.");
  }
}
