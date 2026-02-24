"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { format, isBefore, parseISO } from "date-fns";
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
import type { TodoItem, TodoPriority, TodoSortMode, TodoStatus, TodoViewMode } from "@/types/todo";

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

const PRIORITY_TONE: Record<TodoPriority, "danger" | "warning" | "brand"> = {
  high: "danger",
  medium: "warning",
  low: "brand",
};

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

function priorityWeight(priority: TodoPriority) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function bySortMode(a: TodoItem, b: TodoItem, sortMode: TodoSortMode) {
  if (sortMode === "priority") {
    return priorityWeight(a.priority) - priorityWeight(b.priority);
  }

  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (a.dueDate) return -1;
  if (b.dueDate) return 1;

  return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999);
}

export function TodosWorkspace() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<TodoViewMode>("board");
  const [query, setQuery] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
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
  const [editor, setEditor] = useState<TodoEditorState>({
    title: "",
    status: "todo",
    priority: "medium",
    parentId: null,
    assigneeId: null,
    dueDate: "",
    memo: "",
  });

  const { data: todos, isLoading, isError, refetch } = useTodos();
  const { data: users } = useAppUsers();

  useEffect(() => {
    void markMenuAsRead("todos");
  }, []);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "n" && !editorOpen) {
        event.preventDefault();
        setEditor({
          title: "",
          status: "todo",
          priority: "medium",
          parentId: null,
          assigneeId: null,
          dueDate: "",
          memo: "",
        });
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

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, TodoItem[]>();
    (todos ?? []).forEach((todo) => {
      const list = map.get(todo.parentId) ?? [];
      list.push(todo);
      map.set(todo.parentId, list);
    });
    return map;
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const base = todos ?? [];
    return base.filter((todo) => {
      if (!showCompleted && todo.status === "done") return false;
      if (assigneeFilter !== "all" && todo.assigneeId !== assigneeFilter) return false;
      if (query.trim()) {
        const lower = query.trim().toLowerCase();
        if (!todo.title.toLowerCase().includes(lower) && !(todo.memo ?? "").toLowerCase().includes(lower)) {
          return false;
        }
      }
      return true;
    });
  }, [assigneeFilter, query, showCompleted, todos]);

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

  const getAssignee = (assigneeId: string | null) => users?.find((user) => user.id === assigneeId);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["todos"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleQuickAdd = async (title: string, status: TodoStatus, parentId?: string | null) => {
    if (!title.trim()) return;

    const result = await createTodo({
      title,
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
    } else {
      setQuickListTitle("");
    }
    await refreshQueries();
  };

  const handleSaveEditor = async () => {
    if (!editor.title.trim()) {
      toast.error("업무 제목을 입력해주세요.");
      return;
    }

    if (editor.id) {
      const result = await updateTodo(editor.id, {
        title: editor.title,
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
        title: editor.title,
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

    moved.status = destinationStatus;
    destinationItems.splice(result.destination.index, 0, moved);

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
      setEditor({
        title: "",
        status: "todo",
        priority: "medium",
        parentId: null,
        assigneeId: null,
        dueDate: "",
        memo: "",
      });
    } else {
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
    }
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
    const assignee = getAssignee(todo.assigneeId);
    const isOverdue = Boolean(todo.dueDate && todo.status !== "done" && isBefore(parseISO(todo.dueDate), new Date()));

    return (
      <div key={todo.id}>
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
            isOverdue
              ? "border-[rgb(255_77_109/60%)] bg-[rgb(52_16_24/55%)]"
              : "border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)]"
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
              className="rounded p-1 hover:bg-[rgb(32_48_73/70%)]"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="w-6" />
          )}
          <button type="button" onClick={() => void toggleStatus(todo)} className="rounded p-1 hover:bg-[rgb(32_48_73/70%)]">
            <Check className={`h-4 w-4 ${todo.status === "done" ? "text-[var(--color-brand-2)]" : "text-[var(--color-ink-muted)]"}`} />
          </button>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm ${todo.status === "done" ? "text-[var(--color-ink-muted)] line-through" : "text-[var(--color-ink)]"}`}>
              {todo.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
              {todo.dueDate ? <span>마감 {format(parseISO(todo.dueDate), "M/d (E)", { locale: ko })}</span> : null}
              {assignee ? <span>{assignee.displayName}</span> : null}
            </div>
          </div>
          <Button variant="ghost" className="h-8 px-2" onClick={() => openEditor(todo)}>
            <SquarePen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDeleteTodo(todo.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {isExpanded && children.map((child) => renderTodoRow(child, depth + 1))}

        {isExpanded ? (
          <div className="mt-2 flex items-center gap-2" style={{ marginLeft: `${(depth + 1) * 16}px` }}>
            <Input
              placeholder="서브태스크 추가"
              value={quickListTitle}
              onChange={(event) => setQuickListTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleQuickAdd(quickListTitle, "todo", todo.id);
                }
              }}
            />
            <Button className="h-10 px-3" onClick={() => void handleQuickAdd(quickListTitle, "todo", todo.id)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return <Card className="mt-4 p-6 text-sm text-[var(--color-ink-muted)]">업무 데이터를 불러오는 중입니다...</Card>;
  }

  if (isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">업무 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
            {(
              [
                { id: "board", label: "보드 뷰" },
                { id: "list", label: "리스트 뷰" },
                { id: "grid", label: "그리드 뷰" },
              ] as Array<{ id: TodoViewMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setViewMode(mode.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  viewMode === mode.id ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
            <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="업무 제목/메모 검색" />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--color-ink-muted)]" />
            <select
              className="h-10 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
              className="h-10 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as TodoSortMode)}
            >
              <option value="due_date">마감일순</option>
              <option value="priority">우선순위순</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-[rgb(42_42_42/45%)] px-3 py-2 text-sm">
              <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
              완료 포함
            </label>
            <Button onClick={() => openEditor()}>
              <Plus className="mr-1 h-4 w-4" /> 새 업무
            </Button>
          </div>
        </div>
      </Card>

      {viewMode === "board" ? (
        <DragDropContext onDragEnd={(result) => void handleDrop(result)}>
          <div className="grid gap-4 lg:grid-cols-3">
            {STATUS_META.map((statusMeta) => (
              <Card key={statusMeta.id} className="p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="display-font text-lg">{statusMeta.label}</h3>
                  <Badge tone="brand">{boardTodos[statusMeta.id].length}</Badge>
                </div>
                <Droppable droppableId={statusMeta.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                      {boardTodos[statusMeta.id].map((todo, index) => {
                        const assignee = getAssignee(todo.assigneeId);
                        const isOverdue = Boolean(
                          todo.dueDate && todo.status !== "done" && isBefore(parseISO(todo.dueDate), new Date()),
                        );

                        return (
                          <Draggable draggableId={todo.id} index={index} key={todo.id}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`rounded-xl border p-3 ${
                                  isOverdue
                                    ? "border-[rgb(255_77_109/60%)] bg-[rgb(52_16_24/55%)]"
                                    : "border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)]"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <button type="button" className="mt-0.5" {...dragProvided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-[var(--color-ink-muted)]" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm">{todo.title}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-1">
                                      <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
                                      {todo.dueDate ? (
                                        <span className="text-xs text-[var(--color-ink-muted)]">
                                          {format(parseISO(todo.dueDate), "M/d", { locale: ko })}
                                        </span>
                                      ) : null}
                                      {assignee ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(28_43_66/65%)] px-2 py-0.5 text-xs">
                                          <span className="h-2 w-2 rounded-full" style={{ background: assignee.profileColor }} />
                                          {assignee.displayName}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex justify-end gap-1">
                                  <Button variant="ghost" className="h-7 px-2" onClick={() => void toggleStatus(todo)}>
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" className="h-7 px-2" onClick={() => openEditor(todo)}>
                                    <SquarePen className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" className="h-7 px-2" onClick={() => void handleDeleteTodo(todo.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
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
        <Card className="space-y-2 p-4">
          {((childrenMap.get(null) ?? []).sort((a, b) => bySortMode(a, b, sortMode))).map((todo) => renderTodoRow(todo, 0))}
          {(childrenMap.get(null) ?? []).length === 0 ? (
            <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 업무가 없습니다.</p>
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
              const assignee = getAssignee(todo.assigneeId);
              const isOverdue = Boolean(todo.dueDate && todo.status !== "done" && isBefore(parseISO(todo.dueDate), new Date()));
              return (
                <Card key={todo.id} className={`p-4 ${isOverdue ? "border-[rgb(255_77_109/60%)]" : "border-[rgb(42_42_42/45%)]"}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone={PRIORITY_TONE[todo.priority]}>{PRIORITY_LABEL[todo.priority]}</Badge>
                    <Badge tone={todo.status === "done" ? "brand" : todo.status === "in_progress" ? "warning" : "neutral"}>
                      {STATUS_META.find((status) => status.id === todo.status)?.label}
                    </Badge>
                  </div>
                  <p className="text-sm">{todo.title}</p>
                  {todo.memo ? <p className="mt-2 line-clamp-3 text-xs text-[var(--color-ink-muted)]">{todo.memo}</p> : null}
                  <div className="mt-3 space-y-1 text-xs text-[var(--color-ink-muted)]">
                    {todo.dueDate ? <p>마감 {format(parseISO(todo.dueDate), "M월 d일", { locale: ko })}</p> : <p>마감일 없음</p>}
                    {assignee ? <p>담당 {assignee.displayName}</p> : <p>담당자 없음</p>}
                  </div>
                  <div className="mt-3 flex justify-end gap-1">
                    <Button variant="ghost" className="h-8 px-2" onClick={() => openEditor(todo)}>
                      <SquarePen className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className="h-8 px-2" onClick={() => void toggleStatus(todo)}>
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
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
            className="h-11 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
            className="min-h-28 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
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
