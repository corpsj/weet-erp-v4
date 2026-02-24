"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { addDays, format, isBefore, isToday, parseISO, startOfDay } from "date-fns";
import { ko } from "date-fns/locale";
import { Check, ChevronDown, ChevronRight, Filter, GripVertical, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createTodo, deleteTodo, reorderTodos, updateTodo, updateTodoStatus } from "@/lib/api/actions/todos";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useAppUsers, useTodos } from "@/lib/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { TodoAssignee, TodoItem, TodoPriority, TodoSortMode, TodoStatus, TodoViewMode } from "@/types/todo";

const STATUS_META: Array<{ id: TodoStatus; label: string }> = [
  { id: "todo", label: "할 일" },
  { id: "in_progress", label: "진행 중" },
  { id: "done", label: "완료" },
];

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "높음",
  medium: "중간",
  low: "낮음",
};

const PRIORITY_TONE: Record<TodoPriority, "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

type DueFilter = "all" | "overdue" | "today" | "week" | "none";

type TodoEditorState = {
  id?: string;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  parentId: string | null;
  assigneeId: string | null;
  dueDate: string;
  memo: string;
};

const EMPTY_EDITOR: TodoEditorState = {
  title: "",
  status: "todo",
  priority: "medium",
  parentId: null,
  assigneeId: null,
  dueDate: "",
  memo: "",
};

function priorityWeight(priority: TodoPriority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function bySortMode(a: TodoItem, b: TodoItem, sortMode: TodoSortMode) {
  if (sortMode === "priority") {
    const weight = priorityWeight(a.priority) - priorityWeight(b.priority);
    if (weight !== 0) return weight;
  }

  if (a.dueDate && b.dueDate) {
    const due = a.dueDate.localeCompare(b.dueDate);
    if (due !== 0) return due;
  }

  if (a.dueDate) return -1;
  if (b.dueDate) return 1;
  return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
}

function getDueLabel(dueDate: string | null, status: TodoStatus) {
  if (!dueDate) {
    return { label: "마감일 없음", overdue: false, imminent: false };
  }

  const due = parseISO(dueDate);
  const today = startOfDay(new Date());
  const dueDay = startOfDay(due);

  if (status !== "done" && isBefore(dueDay, today)) {
    return { label: `지연 ${format(dueDay, "M/d (E)", { locale: ko })}`, overdue: true, imminent: false };
  }

  if (isToday(dueDay)) {
    return { label: "오늘 마감", overdue: false, imminent: true };
  }

  return { label: format(dueDay, "M/d (E)", { locale: ko }), overdue: false, imminent: false };
}

function assigneeAvatar(assignee: TodoAssignee | undefined) {
  if (!assignee) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#141414] text-[10px] text-[#9a9a9a">
        -
      </span>
    );
  }

  const initials = assignee.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#1a1a1a] text-[10px] text-[#d4d4d4">
      {initials || assignee.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function TodosWorkspace() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<TodoViewMode>("board");
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<TodoStatus | "all">("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortMode, setSortMode] = useState<TodoSortMode>("due_date");
  const [editorOpen, setEditorOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [quickColumnTitle, setQuickColumnTitle] = useState<Record<TodoStatus, string>>({
    todo: "",
    in_progress: "",
    done: "",
  });
  const [quickListTitle, setQuickListTitle] = useState("");
  const [quickSubtaskTitles, setQuickSubtaskTitles] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<TodoEditorState>(EMPTY_EDITOR);

  const { data: todos, isLoading, isError, refetch } = useTodos();
  const { data: users } = useAppUsers();

  useEffect(() => {
    void markMenuAsRead("todos");
  }, []);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "n" && !editorOpen) {
        event.preventDefault();
        setEditor(EMPTY_EDITOR);
        setEditorOpen(true);
      }

      if (event.key === "Escape" && editorOpen) {
        event.preventDefault();
        setEditorOpen(false);
      }
    };

    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [editorOpen]);

  const userMap = useMemo(() => {
    return new Map((users ?? []).map((user) => [user.id, user]));
  }, [users]);

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, TodoItem[]>();
    (todos ?? []).forEach((todo) => {
      const list = map.get(todo.parentId) ?? [];
      list.push(todo);
      map.set(todo.parentId, list);
    });
    return map;
  }, [todos]);

  const statusCounts = useMemo(() => {
    return (todos ?? []).reduce(
      (acc, todo) => {
        acc.all += 1;
        acc[todo.status] += 1;
        return acc;
      },
      { all: 0, todo: 0, in_progress: 0, done: 0 } as Record<TodoStatus | "all", number>,
    );
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const now = startOfDay(new Date());
    const nextWeek = addDays(now, 7);
    const search = query.trim().toLowerCase();

    return (todos ?? []).filter((todo) => {
      if (!showCompleted && todo.status === "done") return false;
      if (statusFilter !== "all" && todo.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && todo.assigneeId !== assigneeFilter) return false;

      if (dueFilter !== "all") {
        if (!todo.dueDate) return dueFilter === "none";

        const due = startOfDay(parseISO(todo.dueDate));
        if (dueFilter === "none") return false;
        if (dueFilter === "overdue" && !isBefore(due, now)) return false;
        if (dueFilter === "today" && !isToday(due)) return false;
        if (dueFilter === "week" && (isBefore(due, now) || isBefore(nextWeek, due))) return false;
      }

      if (search && !todo.title.toLowerCase().includes(search) && !(todo.memo ?? "").toLowerCase().includes(search)) {
        return false;
      }

      return true;
    });
  }, [assigneeFilter, dueFilter, query, showCompleted, statusFilter, todos]);

  const filteredSet = useMemo(() => new Set(filteredTodos.map((todo) => todo.id)), [filteredTodos]);

  const boardTodos = useMemo(() => {
    const grouped: Record<TodoStatus, TodoItem[]> = { todo: [], in_progress: [], done: [] };
    filteredTodos
      .filter((todo) => todo.parentId === null)
      .sort((a, b) => bySortMode(a, b, sortMode))
      .forEach((todo) => {
        grouped[todo.status].push(todo);
      });
    return grouped;
  }, [filteredTodos, sortMode]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["todos"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleQuickAdd = async (title: string, status: TodoStatus, parentId?: string | null) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const result = await createTodo({
      title: trimmedTitle,
      status,
      parentId: parentId ?? null,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("업무를 추가했습니다.");
    if (!parentId) {
      setQuickColumnTitle((prev) => ({ ...prev, [status]: "" }));
      setQuickListTitle("");
    } else {
      setQuickSubtaskTitles((prev) => ({ ...prev, [parentId]: "" }));
      setExpandedIds((prev) => new Set(prev).add(parentId));
    }
    await refreshQueries();
  };

  const handleSaveEditor = async () => {
    const title = editor.title.trim();
    if (!title) {
      toast.error("업무 제목을 입력해주세요.");
      return;
    }

    if (editor.id) {
      const result = await updateTodo(editor.id, {
        title,
        status: editor.status,
        priority: editor.priority,
        parentId: editor.parentId,
        assigneeId: editor.assigneeId,
        dueDate: editor.dueDate || null,
        memo: editor.memo,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("업무를 수정했습니다.");
    } else {
      const result = await createTodo({
        title,
        status: editor.status,
        priority: editor.priority,
        parentId: editor.parentId,
        assigneeId: editor.assigneeId,
        dueDate: editor.dueDate || null,
        memo: editor.memo,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("업무를 생성했습니다.");
    }

    setEditorOpen(false);
    await refreshQueries();
  };

  const handleDrop = async (result: DropResult) => {
    if (!result.destination) return;
    const sourceStatus = result.source.droppableId as TodoStatus;
    const destinationStatus = result.destination.droppableId as TodoStatus;
    const sourceItems = [...boardTodos[sourceStatus]];
    const destinationItems = sourceStatus === destinationStatus ? sourceItems : [...boardTodos[destinationStatus]];

    const [moved] = sourceItems.splice(result.source.index, 1);
    if (!moved) return;

    const movedUpdated = { ...moved, status: destinationStatus };
    destinationItems.splice(result.destination.index, 0, movedUpdated);

    const payload = [
      ...sourceItems.map((todo, index) => ({ id: todo.id, status: sourceStatus, sortOrder: index + 1, parentId: null })),
      ...destinationItems.map((todo, index) => ({ id: todo.id, status: destinationStatus, sortOrder: index + 1, parentId: null })),
    ];

    const resultAction = await reorderTodos(payload);
    if (!resultAction.ok) {
      toast.error(resultAction.message);
      return;
    }

    await refreshQueries();
  };

  const openEditor = (todo?: TodoItem) => {
    if (!todo) {
      setEditor(EMPTY_EDITOR);
      setEditorOpen(true);
      return;
    }

    setEditor({
      id: todo.id,
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      parentId: todo.parentId,
      assigneeId: todo.assigneeId,
      dueDate: todo.dueDate ?? "",
      memo: todo.memo ?? "",
    });
    setEditorOpen(true);
  };

  const handleDeleteTodo = async (todoId: string) => {
    const result = await deleteTodo(todoId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("업무를 삭제했습니다.");
    await refreshQueries();
  };

  const toggleStatus = async (todo: TodoItem) => {
    const next: TodoStatus = todo.status === "done" ? "todo" : "done";
    const result = await updateTodoStatus(todo.id, next);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(next === "done" ? "완료 처리했습니다." : "완료 해제했습니다.");
    await refreshQueries();
  };

  const renderTodoRow = (todo: TodoItem, depth: number) => {
    if (!filteredSet.has(todo.id)) return null;

    const children = (childrenMap.get(todo.id) ?? []).sort((a, b) => bySortMode(a, b, sortMode));
    const isExpanded = expandedIds.has(todo.id);
    const assignee = todo.assigneeId ? userMap.get(todo.assigneeId) : undefined;
    const dueMeta = getDueLabel(todo.dueDate, todo.status);

    return (
      <div key={todo.id}>
        <div
          className={`group flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
            dueMeta.overdue
              ? "border-[#ff4d6d] bg-[#141414]"
              : todo.status === "done"
                ? "border-[#2a2a2a] bg-[#141414]"
                : "border-[#2a2a2a] bg-[#1a1a1a]"
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() =>
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(todo.id)) next.delete(todo.id);
                  else next.add(todo.id);
                  return next;
                })
              }
              className="rounded p-1 text-[#9a9a9a] transition hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button
            type="button"
            onClick={() => void toggleStatus(todo)}
            className="rounded p-1 text-[#9a9a9a] transition hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
          >
            <Check className={`h-4 w-4 transition ${todo.status === "done" ? "scale-110 text-[#e5e5e5]" : "text-[#9a9a9a]"}`} />
          </button>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${todo.status === "done" ? "text-[#9a9a9a] line-through" : "text-[#e5e5e5]"}`}>{todo.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#9a9a9a]">
              <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
              <span className={dueMeta.overdue ? "text-[#ff4d6d]" : dueMeta.imminent ? "text-[#d4d4d4]" : "text-[#9a9a9a]"}>{dueMeta.label}</span>
              <span className="inline-flex items-center gap-1">
                {assigneeAvatar(assignee)}
                <span>{assignee?.displayName ?? "미할당"}</span>
              </span>
              {children.length > 0 ? <span>서브태스크 {children.length}개</span> : null}
            </div>
          </div>
          <Button variant="ghost" className="h-8 px-2 text-[#b0b0b0] hover:text-[#ffffff]" onClick={() => openEditor(todo)}>
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-8 px-2 text-[#b0b0b0] hover:text-[#ff4d6d]" onClick={() => void handleDeleteTodo(todo.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {isExpanded && children.map((child) => renderTodoRow(child, depth + 1))}

        {isExpanded ? (
          <div className="mt-2 flex items-center gap-2" style={{ marginLeft: `${(depth + 1) * 16}px` }}>
            <Input
              placeholder="서브태스크 추가"
              value={quickSubtaskTitles[todo.id] ?? ""}
              onChange={(event) => setQuickSubtaskTitles((prev) => ({ ...prev, [todo.id]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleQuickAdd(quickSubtaskTitles[todo.id] ?? "", "todo", todo.id);
                }
              }}
            />
            <Button className="h-10 px-3" onClick={() => void handleQuickAdd(quickSubtaskTitles[todo.id] ?? "", "todo", todo.id)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return <Card className="mt-4 border-[#2a2a2a] bg-[#141414] p-6 text-sm text-[#9a9a9a]">업무 데이터를 불러오는 중입니다...</Card>;
  }

  if (isError) {
    return (
      <Card className="mt-4 border-[#2a2a2a] bg-[#141414] p-6">
        <p className="text-sm text-[#ff4d6d]">업무 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  const rootTodos = (childrenMap.get(null) ?? []).sort((a, b) => bySortMode(a, b, sortMode));

  return (
    <div className="mt-4 space-y-4">
      <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-1">
            {(
              [
                { id: "board", label: "보드" },
                { id: "list", label: "리스트" },
                { id: "grid", label: "그리드" },
              ] as Array<{ id: TodoViewMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  viewMode === mode.id ? "bg-[#e5e5e5] text-[#0a0a0a]" : "text-[#9a9a9a] hover:text-[#e5e5e5]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무 제목/메모 검색" />
          </div>

          <Button onClick={() => openEditor()}>
            <Plus className="mr-1 h-4 w-4" /> 새 업무
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-[#9a9a9a]" />
          <div className="inline-flex rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-1">
            {([
              { id: "all", label: "전체" },
              { id: "todo", label: "할 일" },
              { id: "in_progress", label: "진행 중" },
              { id: "done", label: "완료" },
            ] as Array<{ id: TodoStatus | "all"; label: string }>).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  statusFilter === item.id ? "bg-[#2a2a2a] text-[#ffffff]" : "text-[#9a9a9a] hover:text-[#d4d4d4]"
                }`}
              >
                {item.label} {statusCounts[item.id]}
              </button>
            ))}
          </div>

          <select
            className="h-10 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="all">전체 담당자</option>
            {(users ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value as DueFilter)}
          >
            <option value="all">마감 전체</option>
            <option value="overdue">지연만</option>
            <option value="today">오늘 마감</option>
            <option value="week">7일 이내</option>
            <option value="none">마감일 없음</option>
          </select>
          <select
            className="h-10 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as TodoSortMode)}
          >
            <option value="due_date">마감일순</option>
            <option value="priority">우선순위순</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm text-[#b0b0b0]">
            <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
            완료 포함
          </label>
        </div>
      </Card>

      {viewMode === "board" ? (
        <DragDropContext onDragEnd={(result) => void handleDrop(result)}>
          <div className="grid gap-4 lg:grid-cols-3">
            {STATUS_META.map((statusMeta) => (
              <Card key={statusMeta.id} className="border-[#2a2a2a] bg-[#141414] p-3">
                <div className="mb-3 flex items-center justify-between border-b border-[#2a2a2a] pb-2">
                  <h3 className="display-font text-base text-[#e5e5e5]">{statusMeta.label}</h3>
                  <Badge tone={statusMeta.id === "done" ? "brand" : "neutral"}>{boardTodos[statusMeta.id].length}</Badge>
                </div>
                <Droppable droppableId={statusMeta.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {boardTodos[statusMeta.id].map((todo, index) => {
                        const assignee = todo.assigneeId ? userMap.get(todo.assigneeId) : undefined;
                        const dueMeta = getDueLabel(todo.dueDate, todo.status);
                        const childCount = childrenMap.get(todo.id)?.length ?? 0;

                        return (
                          <Draggable draggableId={todo.id} index={index} key={todo.id}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`rounded-xl border p-3 transition ${
                                  dueMeta.overdue ? "border-[#ff4d6d] bg-[#1a1a1a]" : "border-[#2a2a2a] bg-[#1a1a1a]"
                                } ${snapshot.isDragging ? "ring-1 ring-[#d4d4d4]" : ""}`}
                              >
                                <div className="flex items-start gap-2">
                                  <button
                                    type="button"
                                    className="mt-0.5 rounded-md p-1 text-[#9a9a9a] transition hover:bg-[#2a2a2a] hover:text-[#e5e5e5]"
                                    {...dragProvided.dragHandleProps}
                                  >
                                    <GripVertical className="h-4 w-4" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-[#e5e5e5]">{todo.title}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#9a9a9a]">
                                      <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
                                      <span className={dueMeta.overdue ? "text-[#ff4d6d]" : "text-[#9a9a9a]"}>{dueMeta.label}</span>
                                      <span className="inline-flex items-center gap-1">
                                        {assigneeAvatar(assignee)}
                                        <span>{assignee?.displayName ?? "미할당"}</span>
                                      </span>
                                      {childCount > 0 ? <span>서브태스크 {childCount}</span> : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex justify-end gap-1">
                                  <Button variant="ghost" className="h-7 px-2 text-[#b0b0b0] hover:text-[#ffffff]" onClick={() => void toggleStatus(todo)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" className="h-7 px-2 text-[#b0b0b0] hover:text-[#ffffff]" onClick={() => openEditor(todo)}>
                                    <SquarePen className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" className="h-7 px-2 text-[#b0b0b0] hover:text-[#ff4d6d]" onClick={() => void handleDeleteTodo(todo.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}

                      {boardTodos[statusMeta.id].length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0a0a0a] px-3 py-6 text-center text-xs text-[#9a9a9a]">
                          이 상태의 업무가 없습니다.
                        </div>
                      ) : null}

                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <div className="mt-3 flex gap-2">
                  <Input
                    value={quickColumnTitle[statusMeta.id]}
                    onChange={(event) => setQuickColumnTitle((prev) => ({ ...prev, [statusMeta.id]: event.target.value }))}
                    placeholder={`${statusMeta.label} 빠른 추가`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleQuickAdd(quickColumnTitle[statusMeta.id], statusMeta.id);
                      }
                    }}
                  />
                  <Button className="h-10 px-3" onClick={() => void handleQuickAdd(quickColumnTitle[statusMeta.id], statusMeta.id)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </DragDropContext>
      ) : null}

      {viewMode === "list" ? (
        <Card className="space-y-2 border-[#2a2a2a] bg-[#141414] p-4">
          {rootTodos.map((todo) => renderTodoRow(todo, 0))}
          {rootTodos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#2a2a2a] bg-[#0a0a0a] px-3 py-4 text-sm text-[#9a9a9a]">등록된 업무가 없습니다.</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Input
              value={quickListTitle}
              onChange={(event) => setQuickListTitle(event.target.value)}
              placeholder="상위 업무 빠른 추가"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleQuickAdd(quickListTitle, "todo", null);
                }
              }}
            />
            <Button className="h-10 px-3" onClick={() => void handleQuickAdd(quickListTitle, "todo", null)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ) : null}

      {viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredTodos
            .filter((todo) => todo.parentId === null)
            .sort((a, b) => bySortMode(a, b, sortMode))
            .map((todo) => {
              const assignee = todo.assigneeId ? userMap.get(todo.assigneeId) : undefined;
              const dueMeta = getDueLabel(todo.dueDate, todo.status);
              const subtaskCount = childrenMap.get(todo.id)?.length ?? 0;

              return (
                <Card key={todo.id} className={`border p-4 ${dueMeta.overdue ? "border-[#ff4d6d] bg-[#141414]" : "border-[#2a2a2a] bg-[#141414]"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
                    <Badge tone={todo.status === "done" ? "brand" : "neutral"}>
                      {STATUS_META.find((status) => status.id === todo.status)?.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#e5e5e5]">{todo.title}</p>
                  {todo.memo ? <p className="mt-2 line-clamp-3 text-xs text-[#9a9a9a]">{todo.memo}</p> : null}
                  <div className="mt-3 space-y-1 text-xs text-[#9a9a9a]">
                    <p className={dueMeta.overdue ? "text-[#ff4d6d]" : ""}>마감 {dueMeta.label}</p>
                    <p className="inline-flex items-center gap-1">
                      {assigneeAvatar(assignee)}
                      <span>{assignee?.displayName ?? "미할당"}</span>
                    </p>
                    <p>서브태스크 {subtaskCount}개</p>
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" className="h-8 px-2 text-[#b0b0b0] hover:text-[#ffffff]" onClick={() => openEditor(todo)}>
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className="h-8 px-2 text-[#b0b0b0] hover:text-[#ffffff]" onClick={() => void toggleStatus(todo)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
        </div>
      ) : null}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "업무 수정" : "새 업무"}>
        <div className="space-y-3">
          <Input value={editor.title} onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))} placeholder="업무 제목" />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-11 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
              value={editor.status}
              onChange={(event) => setEditor((prev) => ({ ...prev, status: event.target.value as TodoStatus }))}
            >
              {STATUS_META.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
              value={editor.priority}
              onChange={(event) => setEditor((prev) => ({ ...prev, priority: event.target.value as TodoPriority }))}
            >
              {(["high", "medium", "low"] as TodoPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-11 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
              value={editor.assigneeId ?? ""}
              onChange={(event) => setEditor((prev) => ({ ...prev, assigneeId: event.target.value || null }))}
            >
              <option value="">담당자 없음</option>
              {(users ?? []).map((user) => (
                <option value={user.id} key={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={editor.dueDate}
              onChange={(event) => setEditor((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </div>
          <select
            className="h-11 w-full rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#d4d4d4]"
            value={editor.parentId ?? ""}
            onChange={(event) => setEditor((prev) => ({ ...prev, parentId: event.target.value || null }))}
          >
            <option value="">상위 업무 없음</option>
            {(todos ?? [])
              .filter((todo) => todo.id !== editor.id)
              .map((todo) => (
                <option value={todo.id} key={todo.id}>
                  {todo.title}
                </option>
              ))}
          </select>
          <textarea
            className="min-h-28 w-full rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-2 text-sm text-[#d4d4d4] outline-none focus:border-[#e5e5e5]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSaveEditor()}>{editor.id ? "수정" : "생성"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
