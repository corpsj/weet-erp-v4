import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import { type ProposalRow, mapProposal } from "@/types/marketing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    void request;

    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { id } = await context.params;

    const { data: proposal, error: proposalError } = await supabase
      .from("marketing_proposals")
      .select("status")
      .eq("id", id)
      .single();

    if (proposalError) {
      throw proposalError;
    }

    if (proposal.status !== "pending") {
      throw new ApiError("VALIDATION_ERROR", "대기 중인 제안만 승인할 수 있습니다.");
    }

    const { data, error } = await supabase
      .from("marketing_proposals")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return ok(mapProposal(data as ProposalRow));
  } catch (error) {
    return toErrorResponse(error);
  }
}
