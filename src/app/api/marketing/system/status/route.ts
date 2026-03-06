import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";

type SystemStatus = {
  scheduler: { running: boolean; lastRun: string | null; nextRun: string | null };
  ollama: { connected: boolean; model: string };
  naverQuota: { used: number; limit: number; resetAt: string | null };
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

    const mockStatus: SystemStatus = {
      scheduler: { running: false, lastRun: null, nextRun: null },
      ollama: { connected: false, model: "llama3.2" },
      naverQuota: { used: 0, limit: 25000, resetAt: null },
    };

    return ok(mockStatus);
  } catch (error) {
    return toErrorResponse(error);
  }
}
