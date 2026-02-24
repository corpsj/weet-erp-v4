"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import type { TodoInput, TodoPriority, TodoStatus } from "@/types/todo";
import { getActionContext } from "@/lib/api/actions/shared";

const todoSchema = z.object({
  title: z.string().trim().min(1, "업무 제목을 입력해주세요.").max(160, "업무 제목이 너무 깁니다."),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  memo: z.string().max(6000, "메모가 너무 깁니다.").optional(),
  sortOrder: z.number().int().nullable().optional(),
});

const statusSchema = z.enum(["todo", "in_progress", "done"]);

async function collectDescendantIds(rootId: string): Promise<string[]> {
  const { supabase } = await getActionContext();
  const { data, error } = await supabase.from("todos").select("id, parent_id");

  if (error || !data) {
    return [];
  }

  const childrenMap = new Map<string, string[]>();
  data.forEach((row) => {
    if (!row.parent_id) {
      return;
    }
    const list = childrenMap.get(row.parent_id) ?? [];
    list.push(row.id);
    childrenMap.set(row.parent_id, list);
  });

  const stack = [rootId];
  const result: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const children = childrenMap.get(current) ?? [];
    children.forEach((childId) => {
      result.push(childId);
      stack.push(childId);
    });
  }

  return result;
}

export async function createTodo(input: TodoInput): Promise<ActionResult<{ id: string }>> {
  const parsed = todoSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("todos")
      .insert({
        title: parsed.data.title,
        status: parsed.data.status ?? "todo",
        priority: parsed.data.priority ?? "medium",
        parent_id: parsed.data.parentId ?? null,
        assignee_id: parsed.data.assigneeId ?? null,
        due_date: parsed.data.dueDate ?? null,
        memo: parsed.data.memo?.trim() || null,
        sort_order: parsed.data.sortOrder ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("업무 생성에 실패했습니다.");
    }

    revalidatePath("/todos");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("업무 생성 중 오류가 발생했습니다.");
  }
}

export async function updateTodo(todoId: string, input: TodoInput): Promise<ActionResult> {
  if (!todoId) {
    return actionError("수정할 업무를 찾을 수 없습니다.");
  }

  const parsed = todoSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("todos")
      .update({
        title: parsed.data.title,
        status: parsed.data.status ?? "todo",
        priority: parsed.data.priority ?? "medium",
        parent_id: parsed.data.parentId ?? null,
        assignee_id: parsed.data.assigneeId ?? null,
        due_date: parsed.data.dueDate ?? null,
        memo: parsed.data.memo?.trim() || null,
        sort_order: parsed.data.sortOrder ?? null,
      })
      .eq("id", todoId);

    if (error) {
      return actionError("업무 수정에 실패했습니다.");
    }

    revalidatePath("/todos");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("업무 수정 중 오류가 발생했습니다.");
  }
}

export async function updateTodoStatus(todoId: string, status: TodoStatus): Promise<ActionResult> {
  if (!todoId) {
    return actionError("상태를 변경할 업무를 찾을 수 없습니다.");
  }
  if (!statusSchema.safeParse(status).success) {
    return actionError("유효하지 않은 상태값입니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("todos").update({ status }).eq("id", todoId);

    if (error) {
      return actionError("업무 상태 변경에 실패했습니다.");
    }

    if (status === "done") {
      const descendants = await collectDescendantIds(todoId);
      if (descendants.length > 0) {
        await supabase.from("todos").update({ status: "done" }).in("id", descendants);
      }
    }

    revalidatePath("/todos");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("업무 상태 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteTodo(todoId: string): Promise<ActionResult> {
  if (!todoId) {
    return actionError("삭제할 업무를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("todos").delete().eq("id", todoId);

    if (error) {
      return actionError("업무 삭제에 실패했습니다.");
    }

    revalidatePath("/todos");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("업무 삭제 중 오류가 발생했습니다.");
  }
}

type TodoReorderInput = {
  id: string;
  status: TodoStatus;
  sortOrder: number;
  parentId?: string | null;
};

export async function reorderTodos(items: TodoReorderInput[]): Promise<ActionResult> {
  if (items.length === 0) {
    return actionSuccess(undefined);
  }

  try {
    const { supabase } = await getActionContext();

    await Promise.all(
      items.map((item) =>
        supabase
          .from("todos")
          .update({
            status: item.status,
            sort_order: item.sortOrder,
            parent_id: item.parentId ?? null,
          })
          .eq("id", item.id),
      ),
    );

    revalidatePath("/todos");
    return actionSuccess(undefined);
  } catch {
    return actionError("업무 순서 저장에 실패했습니다.");
  }
}

export async function bulkSetPriority(todoIds: string[], priority: TodoPriority): Promise<ActionResult> {
  if (todoIds.length === 0) {
    return actionError("대상을 선택해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("todos").update({ priority }).in("id", todoIds);

    if (error) {
      return actionError("우선순위 변경에 실패했습니다.");
    }

    revalidatePath("/todos");
    return actionSuccess(undefined);
  } catch {
    return actionError("우선순위 변경 중 오류가 발생했습니다.");
  }
}
