import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET() {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { count, error } = await supabase
      .from("marketing_notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);

    if (error) {
      throw error;
    }

    return ok({ count: count ?? 0 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
