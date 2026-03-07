import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { MarketingNotification } from "@/types/marketing";

const BACKEND_URL = "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const searchParams = request.nextUrl.searchParams;
    const qs = searchParams.toString();
    const url = `${BACKEND_URL}/api/notifications${qs ? `?${qs}` : ""}`;

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new ApiError("INTERNAL_ERROR", "알림 목록을 불러오지 못했습니다.");
    }

    const notifications: MarketingNotification[] = await res.json();
    return ok(notifications);
  } catch (error) {
    return toErrorResponse(error);
  }
}
