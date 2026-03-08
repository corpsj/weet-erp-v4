import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const body = (await request.json()) as { ids?: string[] };
    const now = new Date().toISOString();

    if (body.ids && body.ids.length > 0) {
      const { error } = await supabase
        .from("marketing_notifications")
        .update({ read_at: now })
        .in("id", body.ids)
        .is("read_at", null);

      if (error) throw error;
      return ok({ updated: body.ids.length });
    }

    const { data, error } = await supabase
      .from("marketing_notifications")
      .update({ read_at: now })
      .is("read_at", null)
      .select("id");

    if (error) throw error;
    return ok({ updated: (data ?? []).length });
  } catch (error) {
    return toErrorResponse(error);
  }
}
