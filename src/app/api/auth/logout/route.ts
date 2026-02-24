import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

export async function POST() {
  try {
    const supabase = await createRouteClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new ApiError("INTERNAL_ERROR", "로그아웃에 실패했습니다.");
    }

    return ok({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
