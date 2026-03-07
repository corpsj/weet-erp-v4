import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

const BACKEND_URL = "http://localhost:8000";

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const body = await request.json();

    const res = await fetch(`${BACKEND_URL}/api/notifications/mark-read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new ApiError("INTERNAL_ERROR", "알림 읽음 처리에 실패했습니다.");
    }

    const data: { updated: number } = await res.json();
    return ok(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
