"use client";

import { addDays, endOfWeek, format, startOfWeek } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { HubSnapshot } from "@/types/hub";

export function useHubSnapshot() {
  return useQuery({
    queryKey: ["hub-snapshot"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<HubSnapshot> => {
      const supabase = createClient();
      const today = new Date();
      const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const nextMonth = format(addDays(today, 30), "yyyy-MM-dd");
      const nowDate = format(today, "yyyy-MM-dd");

      const [
        todoCountResult,
        unpaidExpensesCountResult,
        unpaidExpensesAmountResult,
        utilityCountResult,
        utilityAmountResult,
        thisWeekEventsResult,
        focusTodosResult,
        upcomingEventsResult,
      ] = await Promise.all([
        supabase.from("todos").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("expense_claims").select("id", { count: "exact", head: true }).eq("status", "unpaid"),
        supabase.from("expense_claims").select("amount").eq("status", "unpaid"),
        supabase.from("utility_bills").select("id", { count: "exact", head: true }).eq("is_paid", false),
        supabase.from("utility_bills").select("amount").eq("is_paid", false),
        supabase
          .from("calendar_events")
          .select("id", { count: "exact", head: true })
          .gte("event_date", weekStart)
          .lte("event_date", weekEnd),
        supabase
          .from("todos")
          .select("id, title, status, priority, parent_id, assignee_id, due_date, memo, sort_order, created_by, created_at, updated_at")
          .neq("status", "done")
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true })
          .limit(5),
        supabase
          .from("calendar_events")
          .select("id, title, event_date, color, memo, created_by, created_at, updated_at")
          .gte("event_date", nowDate)
          .lte("event_date", nextMonth)
          .order("event_date", { ascending: true })
          .limit(4),
      ]);

      if (
        todoCountResult.error ||
        unpaidExpensesCountResult.error ||
        unpaidExpensesAmountResult.error ||
        utilityCountResult.error ||
        utilityAmountResult.error ||
        thisWeekEventsResult.error ||
        focusTodosResult.error ||
        upcomingEventsResult.error
      ) {
        throw new Error("허브 데이터를 불러오지 못했습니다.");
      }

      const unpaidExpenseAmount = (unpaidExpensesAmountResult.data ?? []).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      );
      const unpaidUtilityAmount = (utilityAmountResult.data ?? []).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      );

      return {
        metrics: {
          openTodos: todoCountResult.count ?? 0,
          unpaidExpenseCount: unpaidExpensesCountResult.count ?? 0,
          unpaidExpenseAmount,
          unpaidUtilityCount: utilityCountResult.count ?? 0,
          unpaidUtilityAmount,
          thisWeekEventCount: thisWeekEventsResult.count ?? 0,
        },
        focusTodos: (focusTodosResult.data ?? []).map((todo) => ({
          id: todo.id,
          title: todo.title,
          status: todo.status,
          priority: todo.priority,
          parentId: todo.parent_id,
          assigneeId: todo.assignee_id,
          dueDate: todo.due_date,
          memo: todo.memo,
          sortOrder: todo.sort_order,
          createdBy: todo.created_by,
          createdAt: todo.created_at,
          updatedAt: todo.updated_at,
        })),
        upcomingEvents: (upcomingEventsResult.data ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          eventDate: event.event_date,
          color: event.color,
          memo: event.memo,
          createdBy: event.created_by,
          createdAt: event.created_at,
          updatedAt: event.updated_at,
        })),
      };
    },
  });
}
