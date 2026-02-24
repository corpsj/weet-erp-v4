"use client";

import { endOfMonth, format, startOfMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/types/calendar";

function mapCalendarEvent(row: {
  id: string;
  title: string;
  event_date: string;
  color: "yellow" | "blue" | "red";
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    color: row.color,
    memo: row.memo,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useCalendarEvents(month: Date) {
  const start = format(startOfMonth(month), "yyyy-MM-dd");
  const end = format(endOfMonth(month), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["calendar-events", start, end],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<CalendarEvent[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, event_date, color, memo, created_by, created_at, updated_at")
        .gte("event_date", start)
        .lte("event_date", end)
        .order("event_date", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error("캘린더 일정을 불러오지 못했습니다.");
      }

      return (data ?? []).map(mapCalendarEvent);
    },
  });
}
