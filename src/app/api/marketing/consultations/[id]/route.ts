import { ApiError, ok, toErrorResponse } from "@/lib/api/errors";
import { createRouteClient } from "@/lib/supabase/route";
import { type ConsultationRow, mapConsultation } from "@/types/marketing";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
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

    const { data, error } = await supabase
      .from("marketing_consultations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw error;
    }

    return ok(mapConsultation(data as ConsultationRow));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = await createRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
    }

    const { id } = await context.params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.status) {
      updates.status = body.status;

      if (body.status === "scheduled") {
        updates.scheduled_at = new Date().toISOString();
      }

      if (["completed", "contracted", "lost"].includes(body.status)) {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    const { data, error } = await supabase
      .from("marketing_consultations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return ok(mapConsultation(data as ConsultationRow));
  } catch (error) {
    return toErrorResponse(error);
  }
}
