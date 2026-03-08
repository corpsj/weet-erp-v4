import type { NextRequest } from "next/server";
import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import { type ConsultationRow, mapConsultation } from "@/types/marketing";

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
    const limit = request.nextUrl.searchParams.get("limit");

    let query = supabase.from("marketing_consultations").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    if (limit) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query.order("requested_at", {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    return ok(((data ?? []) as ConsultationRow[]).map(mapConsultation));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from("marketing_consultations")
      .insert({
        lead_id: body.leadId,
        persona_type: body.personaType ?? null,
        request_channel: body.requestChannel,
        status: "requested",
        notes: body.notes ?? null,
        metadata: body.metadata ?? {},
        requested_at: new Date().toISOString(),
      })
      .select("id, status")
      .single();

    if (error) {
      throw error;
    }

    return ok({ id: data.id, status: data.status });
  } catch (error) {
    return toErrorResponse(error);
  }
}
