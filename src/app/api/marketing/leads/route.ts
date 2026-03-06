import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import type { MarketingLead } from "@/types/marketing";

type LeadRow = {
  id: string;
  platform: string;
  username: string;
  score: number;
  persona_type: string | null;
  journey_stage: string;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function mapLead(lead: LeadRow): MarketingLead {
  return {
    id: lead.id,
    platform: lead.platform,
    username: lead.username,
    score: lead.score,
    personaType: lead.persona_type,
    journeyStage: lead.journey_stage,
    source: lead.source,
    metadata: lead.metadata ?? {},
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
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

    const searchParams = request.nextUrl.searchParams;
    const scoreMin = searchParams.get("score_min");
    const persona = searchParams.get("persona");
    const stage = searchParams.get("stage");

    let query = supabase.from("marketing_leads").select("*");

    if (persona) {
      query = query.eq("persona_type", persona);
    }

    if (scoreMin) {
      query = query.gte("score", Number(scoreMin));
    }

    if (stage) {
      query = query.eq("journey_stage", stage);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return ok(((data ?? []) as LeadRow[]).map(mapLead));
  } catch (error) {
    return toErrorResponse(error);
  }
}
