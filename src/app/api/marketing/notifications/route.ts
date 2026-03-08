import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import { type NotificationRow, mapNotification } from "@/types/marketing";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const category = request.nextUrl.searchParams.get("category");
    const unreadOnly = request.nextUrl.searchParams.get("unread_only") === "true";
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

    let query = supabase
      .from("marketing_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq("category", category);
    }
    if (unreadOnly) {
      query = query.is("read_at", null);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ok(((data ?? []) as NotificationRow[]).map(mapNotification));
  } catch (error) {
    return toErrorResponse(error);
  }
}
