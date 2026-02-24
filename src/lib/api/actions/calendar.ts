"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import type { CalendarEventColor, CalendarEventInput } from "@/types/calendar";
import { getActionContext } from "@/lib/api/actions/shared";

const calendarSchema = z.object({
  title: z.string().trim().min(1, "일정 제목을 입력해주세요.").max(120, "일정 제목이 너무 깁니다."),
  eventDate: z.string().date(),
  color: z.enum(["yellow", "blue", "red"]),
  memo: z.string().max(4000, "메모가 너무 깁니다.").optional(),
});

type UpsertCalendarEventInput = CalendarEventInput & { id?: string };

export async function upsertCalendarEvent(input: UpsertCalendarEventInput): Promise<ActionResult<{ id: string }>> {
  const parsed = calendarSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const payload = {
      title: parsed.data.title,
      event_date: parsed.data.eventDate,
      color: parsed.data.color as CalendarEventColor,
      memo: parsed.data.memo?.trim() || null,
    };

    if (input.id) {
      const { data, error } = await supabase
        .from("calendar_events")
        .update(payload)
        .eq("id", input.id)
        .select("id")
        .single();

      if (error || !data) {
        return actionError("일정 수정에 실패했습니다.");
      }

      revalidatePath("/calendar");
      revalidatePath("/hub");
      return actionSuccess({ id: data.id });
    }

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        ...payload,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("일정 생성에 실패했습니다.");
    }

    revalidatePath("/calendar");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("일정 처리 중 오류가 발생했습니다.");
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<ActionResult> {
  if (!eventId) {
    return actionError("삭제할 일정을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("calendar_events").delete().eq("id", eventId);

    if (error) {
      return actionError("일정 삭제에 실패했습니다.");
    }

    revalidatePath("/calendar");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("일정 삭제 중 오류가 발생했습니다.");
  }
}
