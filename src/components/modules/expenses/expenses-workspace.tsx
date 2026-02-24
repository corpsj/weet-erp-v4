"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Download, FileImage, FilterX, Plus, Receipt, Search, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createExpenseClaim,
  deleteExpenseClaim,
  deleteExpenseReceipt,
  getExpenseReceiptSignedUrl,
  toggleExpenseStatus,
  updateExpenseClaim,
  uploadExpenseReceipt,
} from "@/lib/api/actions/expenses";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useExpenseClaims, useExpenseReceipts } from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/utils/format";
import type { ExpenseCategory, ExpenseClaim, ExpenseStatus } from "@/types/expense";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const EXPENSE_CATEGORIES: ExpenseCategory[] = ["식비", "교통비", "사무용품", "현장 경비", "기타"];
type ExpenseFilter = "all" | ExpenseStatus;
type ExpenseCategoryFilter = "all" | ExpenseCategory;
type DatePreset = "all" | "thisMonth" | "lastMonth" | "custom";

type EditorState = {
  id?: string;
  title: string;
  amount: string;
  used_date: string;
  category: ExpenseCategory;
  memo: string;
  status: ExpenseStatus;
};

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  unpaid: "미지급",
  paid: "지급 완료",
};

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getMonthRange = (offset = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    from: toDateInput(start),
    to: toDateInput(end),
  };
};

export function ExpensesWorkspace() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ExpenseFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategoryFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [keyword, setKeyword] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    title: "",
    amount: "",
    used_date: new Date().toISOString().slice(0, 10),
    category: "식비",
    memo: "",
    status: "unpaid",
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: expenses, isLoading, isError, refetch } = useExpenseClaims();
  const { data: receipts } = useExpenseReceipts();

  useEffect(() => {
    void markMenuAsRead("expenses");
  }, []);

  const receiptMap = useMemo(() => {
    const map = new Map<string, typeof receipts>();
    (receipts ?? []).forEach((receipt) => {
      const list = map.get(receipt.expense_id) ?? [];
      list.push(receipt);
      map.set(receipt.expense_id, list);
    });
    return map;
  }, [receipts]);

  const filteredExpenses = useMemo(() => {
    const base = expenses ?? [];
    return base.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (dateFrom && item.used_date < dateFrom) return false;
      if (dateTo && item.used_date > dateTo) return false;
      if (keyword.trim()) {
        const q = keyword.trim().toLowerCase();
        const target = `${item.title} ${item.memo ?? ""}`.toLowerCase();
        if (!target.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, statusFilter, categoryFilter, dateFrom, dateTo, keyword]);

  const categorySummary = useMemo(() => {
    return EXPENSE_CATEGORIES.map((category) => {
      const total = filteredExpenses
        .filter((item) => item.category === category)
        .reduce((sum, item) => sum + item.amount, 0);
      return { category, total };
    }).filter((item) => item.total > 0);
  }, [filteredExpenses]);

  const unpaidSummary = useMemo(() => {
    const unpaid = (expenses ?? []).filter((item) => item.status === "unpaid");
    return {
      count: unpaid.length,
      amount: unpaid.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [expenses]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-receipts"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    if (preset === "thisMonth") {
      const range = getMonthRange(0);
      setDateFrom(range.from);
      setDateTo(range.to);
      return;
    }
    if (preset === "lastMonth") {
      const range = getMonthRange(-1);
      setDateFrom(range.from);
      setDateTo(range.to);
    }
  };

  const handleResetFilters = () => {
    setStatusFilter("all");
    setCategoryFilter("all");
    setKeyword("");
    applyDatePreset("all");
  };

  const handleExportCsv = () => {
    if (filteredExpenses.length === 0) {
      toast.error("내보낼 경비가 없습니다.");
      return;
    }
    const header = ["제목", "사용일", "카테고리", "금액", "상태", "메모", "영수증 수"];
    const rows = filteredExpenses.map((expense) => {
      const receiptCount = (receiptMap.get(expense.id) ?? []).length;
      return [
        expense.title,
        expense.used_date,
        expense.category,
        String(expense.amount),
        STATUS_LABEL[expense.status],
        expense.memo ?? "",
        String(receiptCount),
      ];
    });
    const escapeCell = (value: string) => `"${value.replaceAll("\"", '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expenses-${toDateInput(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const openCreate = () => {
    setEditor({
      title: "",
      amount: "",
      used_date: new Date().toISOString().slice(0, 10),
      category: "식비",
      memo: "",
      status: "unpaid",
    });
    setPendingFiles([]);
    setEditorOpen(true);
  };

  const openEdit = (expense: ExpenseClaim) => {
    setEditor({
      id: expense.id,
      title: expense.title,
      amount: String(expense.amount),
      used_date: expense.used_date,
      category: expense.category,
      memo: expense.memo ?? "",
      status: expense.status,
    });
    setPendingFiles([]);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editor.title.trim()) {
      toast.error("경비 제목을 입력해주세요.");
      return;
    }

    const amount = Number(editor.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("금액을 올바르게 입력해주세요.");
      return;
    }

    const payload = {
      title: editor.title,
      amount,
      used_date: editor.used_date,
      category: editor.category,
      memo: editor.memo,
      status: editor.status,
    };

    let expenseId = editor.id;
    if (editor.id) {
      const result = await updateExpenseClaim(editor.id, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    } else {
      const result = await createExpenseClaim(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      expenseId = result.data.id;
    }

    if (expenseId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.set("expenseId", expenseId);
        formData.set("file", file);
        const uploadResult = await uploadExpenseReceipt(formData);
        if (!uploadResult.ok) {
          toast.error(uploadResult.message);
          return;
        }
      }
    }

    toast.success(editor.id ? "경비를 수정했습니다." : "경비를 등록했습니다.");
    setEditorOpen(false);
    setPendingFiles([]);
    await refreshQueries();
  };

  const handleToggleStatus = async (expense: ExpenseClaim) => {
    const next: ExpenseStatus = expense.status === "unpaid" ? "paid" : "unpaid";
    const result = await toggleExpenseStatus(expense.id, next);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(next === "paid" ? "지급 완료로 변경했습니다." : "미지급으로 변경했습니다.");
    await refreshQueries();
  };

  const handleDeleteExpense = async (expenseId: string) => {
    const result = await deleteExpenseClaim(expenseId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("경비를 삭제했습니다.");
    await refreshQueries();
  };

  const handleOpenReceipt = async (receiptId: string) => {
    const result = await getExpenseReceiptSignedUrl(receiptId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteReceipt = async (receiptId: string) => {
    const result = await deleteExpenseReceipt(receiptId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("영수증을 삭제했습니다.");
    await refreshQueries();
  };

  if (isLoading) {
    return (
      <div className="mt-4 space-y-4">
        <Card className="h-24 animate-pulse" />
        <Card className="h-96 animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">경비 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미지급 건수</p>
          <p className="display-font mt-1 text-3xl">{unpaidSummary.count}건</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미지급 총액</p>
          <p className="display-font mt-1 text-3xl">{formatCurrency(unpaidSummary.amount)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">조회 결과</p>
          <p className="display-font mt-1 text-3xl">{filteredExpenses.length}건</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] p-1">
            {[
              { id: "all" as const, label: "전체" },
              { id: "unpaid" as const, label: "미지급" },
              { id: "paid" as const, label: "지급 완료" },
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  statusFilter === filter.id
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
            </div>
            <div className="inline-flex rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] p-1">
              {[
                { id: "all" as const, label: "카테고리 전체" },
                ...EXPENSE_CATEGORIES.map((category) => ({ id: category, label: category })),
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setCategoryFilter(filter.id as ExpenseCategoryFilter)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    categoryFilter === filter.id
                      ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                      : "text-[var(--color-ink-muted)]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleExportCsv()}>
              <Download className="mr-1 h-4 w-4" /> CSV 내보내기
            </Button>
            <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 경비 등록
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 xl:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
            <Input
              className="pl-9"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="제목/메모 검색"
            />
          </div>

          <div className="inline-flex items-center rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] p-1">
            {[
              { id: "all" as const, label: "전체 기간" },
              { id: "thisMonth" as const, label: "이번 달" },
              { id: "lastMonth" as const, label: "지난 달" },
              { id: "custom" as const, label: "직접 선택" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyDatePreset(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  datePreset === preset.id
                    ? "bg-[var(--color-ink)] text-[var(--color-bg)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDatePreset("custom");
                setDateFrom(event.target.value);
              }}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDatePreset("custom");
                setDateTo(event.target.value);
              }}
            />
          </div>

          <Button variant="ghost" onClick={handleResetFilters}>
            <FilterX className="mr-1 h-4 w-4" /> 필터 초기화
          </Button>
        </div>

        {categorySummary.length > 0 ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {categorySummary.map((item) => (
              <div key={item.category} className="rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-3 py-2">
                <p className="text-xs text-[var(--color-ink-muted)]">{item.category}</p>
                <p className="mt-1 text-sm font-semibold">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 hidden lg:block">
          <Table>
            <THead>
              <TR>
                <TH>제목</TH>
                <TH>사용일</TH>
                <TH>카테고리</TH>
                <TH className="text-right">금액</TH>
                <TH>상태</TH>
                <TH>영수증</TH>
                <TH className="w-[140px] text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {filteredExpenses.map((expense) => {
                const receiptItems = receiptMap.get(expense.id) ?? [];
                return (
                  <TR key={expense.id}>
                    <TD>
                      <div>
                        <p>{expense.title}</p>
                        {expense.memo ? <p className="text-xs text-[var(--color-ink-muted)]">{expense.memo}</p> : null}
                      </div>
                    </TD>
                    <TD>{expense.used_date}</TD>
                    <TD>{expense.category}</TD>
                    <TD className="text-right">{formatCurrency(expense.amount)}</TD>
                    <TD>
                      <button type="button" className="rounded-md" onClick={() => void handleToggleStatus(expense)}>
                        <Badge tone={expense.status === "paid" ? "neutral" : "danger"}>{STATUS_LABEL[expense.status]}</Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{receiptItems.length}장</Badge>
                        {receiptItems.slice(0, 2).map((receipt) => (
                          <button
                            key={receipt.id}
                            type="button"
                            className="inline-flex h-7 max-w-[160px] items-center gap-1 rounded-md border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-2 text-xs"
                            onClick={() => void handleOpenReceipt(receipt.id)}
                          >
                            <FileImage className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{receipt.file_name}</span>
                          </button>
                        ))}
                      </div>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(expense)}>
                          <SquarePen className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDeleteExpense(expense.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <div className="mt-4 space-y-2 lg:hidden">
          {filteredExpenses.map((expense) => {
            const receiptItems = receiptMap.get(expense.id) ?? [];
            return (
              <div key={expense.id} className="rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{expense.title}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {expense.used_date} · {expense.category}
                    </p>
                  </div>
                  <button type="button" onClick={() => void handleToggleStatus(expense)}>
                    <Badge tone={expense.status === "paid" ? "neutral" : "danger"}>{STATUS_LABEL[expense.status]}</Badge>
                  </button>
                </div>
                <p className="mt-2 display-font text-lg">{formatCurrency(expense.amount)}</p>
                {expense.memo ? <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{expense.memo}</p> : null}

                <div className="mt-2 space-y-1">
                  <Badge tone="neutral">영수증 {receiptItems.length}장</Badge>
                  {receiptItems.map((receipt) => (
                    <button
                      key={receipt.id}
                      type="button"
                      className="flex w-full items-center gap-1.5 rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
                      onClick={() => void handleOpenReceipt(receipt.id)}
                    >
                      <Receipt className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{receipt.file_name}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-2 flex justify-end gap-1">
                  <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(expense)}>
                    <SquarePen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDeleteExpense(expense.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredExpenses.length === 0 ? (
          <p className="mt-4 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">
            조회 조건에 맞는 경비가 없습니다.
          </p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "경비 수정" : "경비 등록"}>
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-ink-muted)]">실제 결제 기준으로 사용일/카테고리/상태를 입력해주세요.</p>
          <Input value={editor.title} onChange={(event) => setEditor((prev) => ({ ...prev, title: event.target.value }))} placeholder="제목" />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              value={editor.amount}
              onChange={(event) => setEditor((prev) => ({ ...prev, amount: event.target.value }))}
              placeholder="금액"
            />
            <Input
              type="date"
              value={editor.used_date}
              onChange={(event) => setEditor((prev) => ({ ...prev, used_date: event.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-3 text-sm"
              value={editor.category}
              onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))}
            >
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-3 text-sm"
              value={editor.status}
              onChange={(event) => setEditor((prev) => ({ ...prev, status: event.target.value as ExpenseStatus }))}
            >
              <option value="unpaid">미지급</option>
              <option value="paid">지급 완료</option>
            </select>
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-ink)]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />

          <div className="space-y-2 rounded-xl border border-[var(--color-line-2)] bg-[var(--color-bg-panel)] p-3">
            <p className="text-xs text-[var(--color-ink-muted)]">영수증 업로드 (복수 선택 가능)</p>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => setPendingFiles(Array.from(event.target.files ?? []))}
            />
            {pendingFiles.length > 0 ? <p className="text-xs text-[var(--color-ink)]">선택된 파일 {pendingFiles.length}개</p> : null}

            {editor.id ? (
              <div className="space-y-1">
                {(receiptMap.get(editor.id) ?? []).map((receipt) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--color-line-2)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
                  >
                    <button type="button" className="truncate text-left" onClick={() => void handleOpenReceipt(receipt.id)}>
                      {receipt.file_name}
                    </button>
                    <Button variant="ghost" className="h-7 px-2" onClick={() => void handleDeleteReceipt(receipt.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSave()}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> 저장
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
