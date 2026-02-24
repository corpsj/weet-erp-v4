"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TodoItem } from "@/types/todo";

function mapTodo(row: {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  parent_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  memo: string | null;
  sort_order: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): TodoItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    parentId: row.parent_id,
    assigneeId: row.assignee_id,
    dueDate: row.due_date,
    memo: row.memo,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<TodoItem[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("todos")
        .select("id, title, status, priority, parent_id, assignee_id, due_date, memo, sort_order, created_by, created_at, updated_at")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error("업무 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map(mapTodo);
    },
  });
}
