import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

const SETTINGS_KEY = "signal_collection_requested";

export async function POST() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const now = new Date().toISOString();

    const { error } = await supabase.from("marketing_settings").upsert({
      key: SETTINGS_KEY,
      value: { requested: true, requested_at: now, requested_by: user.id },
    });

    if (error) throw error;

    return ok({
      triggered: true,
      message: "시그널 수집이 요청되었습니다.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
