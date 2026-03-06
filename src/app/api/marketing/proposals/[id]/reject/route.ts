import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { MarketingProposal } from "@/types/marketing";

type ProposalRow = {
  id: string;
  signal_id: string | null;
  title: string;
  action_type: string | null;
  content_draft: string | null;
  status: string;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type RejectBody = {
  reason?: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function mapProposal(proposal: ProposalRow): MarketingProposal {
  return {
    id: proposal.id,
    signalId: proposal.signal_id,
    title: proposal.title,
    actionType: proposal.action_type,
    contentDraft: proposal.content_draft,
    status: proposal.status,
    approvedAt: proposal.approved_at,
    rejectionReason: proposal.rejection_reason,
    createdAt: proposal.created_at,
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { reason } = (await request.json()) as RejectBody;
    const rejectionReason = reason?.trim() || "관리자 거부";

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
      throw new ApiError("VALIDATION_ERROR", "대기 중인 제안만 거부할 수 있습니다.");
    }

    const { data, error } = await supabase
      .from("marketing_proposals")
      .update({
        status: "rejected",
        rejection_reason: rejectionReason,
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
