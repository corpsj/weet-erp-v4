import type { NextRequest } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const status = request.nextUrl.searchParams.get("status");

    let query = supabase.from("marketing_proposals").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ok(((data ?? []) as ProposalRow[]).map(mapProposal));
  } catch (error) {
    return toErrorResponse(error);
  }
}
