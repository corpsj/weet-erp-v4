export type TodoStatus = "todo" | "in_progress" | "done";
export type TodoPriority = "high" | "medium" | "low";

export type TodoAssignee = {
  id: string;
  username: string;
  displayName: string;
  profileColor: string;
};

export type TodoItem = {
  id: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  parentId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  memo: string | null;
  sortOrder: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TodoInput = {
  title: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  parentId?: string | null;
  assigneeId?: string | null;
  dueDate?: string | null;
  memo?: string;
  sortOrder?: number | null;
};

export type TodoViewMode = "board" | "list" | "grid";
export type TodoSortMode = "due_date" | "priority";
