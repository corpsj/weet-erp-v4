import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { NotificationUnreadCount } from "@/types/marketing";

const BACKEND_URL = "http://localhost:8000";

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const res = await fetch(`${BACKEND_URL}/api/notifications/unread-count`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new ApiError("INTERNAL_ERROR", "읽지 않은 알림 수를 불러오지 못했습니다.");
    }

    const data: NotificationUnreadCount = await res.json();
    return ok(data);
  } catch (error) {
    return toErrorResponse(error);
  }
}
