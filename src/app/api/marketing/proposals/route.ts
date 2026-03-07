import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import { type ProposalRow, mapProposal } from "@/types/marketing";

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

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ok(((data ?? []) as ProposalRow[]).map(mapProposal));
  } catch (error) {
    return toErrorResponse(error);
  }
}
