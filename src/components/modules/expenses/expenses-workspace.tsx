"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileImage, Plus, Receipt, SquarePen, Trash2 } from "lucide-react";
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

export function ExpensesWorkspace() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ExpenseFilter>("all");
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
    if (statusFilter === "all") return base;
    return base.filter((item) => item.status === statusFilter);
  }, [expenses, statusFilter]);

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
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미지급 건수</p>
          <p className="display-font mt-1 text-3xl">{unpaidSummary.count}건</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미지급 총액</p>
          <p className="display-font mt-1 text-3xl text-[var(--color-warning)]">{formatCurrency(unpaidSummary.amount)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
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
                  statusFilter === filter.id ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 경비 등록
          </Button>
        </div>

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
                      <button type="button" onClick={() => void handleToggleStatus(expense)}>
                        <Badge tone={expense.status === "paid" ? "brand" : "warning"}>{STATUS_LABEL[expense.status]}</Badge>
                      </button>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone="neutral">{receiptItems.length}장</Badge>
                        {receiptItems.slice(0, 2).map((receipt) => (
                          <Button
                            key={receipt.id}
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => void handleOpenReceipt(receipt.id)}
                          >
                            <FileImage className="h-3.5 w-3.5" />
                          </Button>
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
              <div key={expense.id} className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{expense.title}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {expense.used_date} · {expense.category}
                    </p>
                  </div>
                  <button type="button" onClick={() => void handleToggleStatus(expense)}>
                    <Badge tone={expense.status === "paid" ? "brand" : "warning"}>{STATUS_LABEL[expense.status]}</Badge>
                  </button>
                </div>
                <p className="mt-2 display-font text-lg">{formatCurrency(expense.amount)}</p>
                {expense.memo ? <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{expense.memo}</p> : null}

                <div className="mt-2 flex items-center gap-1">
                  <Badge tone="neutral">영수증 {receiptItems.length}장</Badge>
                  {receiptItems.map((receipt) => (
                    <Button key={receipt.id} variant="ghost" className="h-7 px-2" onClick={() => void handleOpenReceipt(receipt.id)}>
                      <Receipt className="h-3.5 w-3.5" />
                    </Button>
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
          <p className="mt-4 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 경비가 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "경비 수정" : "경비 등록"}>
        <div className="space-y-3">
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
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
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
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={editor.status}
              onChange={(event) => setEditor((prev) => ({ ...prev, status: event.target.value as ExpenseStatus }))}
            >
              <option value="unpaid">미지급</option>
              <option value="paid">지급 완료</option>
            </select>
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />

          <div className="space-y-2 rounded-xl border border-[rgb(42_42_42/45%)] p-3">
            <p className="text-xs text-[var(--color-ink-muted)]">영수증 업로드 (복수 선택 가능)</p>
            <Input
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => setPendingFiles(Array.from(event.target.files ?? []))}
            />
            {pendingFiles.length > 0 ? <p className="text-xs text-[var(--color-brand)]">선택된 파일 {pendingFiles.length}개</p> : null}

            {editor.id ? (
              <div className="space-y-1">
                {(receiptMap.get(editor.id) ?? []).map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between rounded-lg bg-[rgb(15_24_38/80%)] px-2 py-1.5 text-xs">
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
