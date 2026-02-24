"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createBankTransaction,
  deleteBankTransaction,
  updateBankTransaction,
} from "@/lib/api/actions/bank-transactions";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useBankTransactions } from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/utils/format";
import { BANK_TRANSACTION_CATEGORIES } from "@/types/bank-transaction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { BankTransaction, BankTransactionCategory, BankTransactionType } from "@/types/bank-transaction";

type TypeFilter = "all" | BankTransactionType;

type EditorState = {
  id?: string;
  transaction_date: string;
  type: BankTransactionType;
  amount: string;
  description: string;
  bank_name: string;
  account_number: string;
  balance_after: string;
  category: BankTransactionCategory | "";
};

const TYPE_LABEL: Record<BankTransactionType, string> = {
  deposit: "입금",
  withdrawal: "출금",
};

export function BankTransactionsWorkspace() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    transaction_date: new Date().toISOString().slice(0, 16),
    type: "deposit",
    amount: "",
    description: "",
    bank_name: "",
    account_number: "",
    balance_after: "",
    category: "",
  });

  const { data: transactions, isLoading, isError, refetch } = useBankTransactions();

  useEffect(() => {
    void markMenuAsRead("bank_transactions");
  }, []);

  const filteredTransactions = useMemo(() => {
    const base = transactions ?? [];
    if (typeFilter === "all") return base;
    return base.filter((item) => item.type === typeFilter);
  }, [transactions, typeFilter]);

  const summary = useMemo(() => {
    const depositTotal = (transactions ?? []).filter((item) => item.type === "deposit").reduce((sum, item) => sum + item.amount, 0);
    const withdrawalTotal = (transactions ?? [])
      .filter((item) => item.type === "withdrawal")
      .reduce((sum, item) => sum + item.amount, 0);
    return {
      depositTotal,
      withdrawalTotal,
      netBalance: depositTotal - withdrawalTotal,
    };
  }, [transactions]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const openCreate = () => {
    setEditor({
      transaction_date: new Date().toISOString().slice(0, 16),
      type: "deposit",
      amount: "",
      description: "",
      bank_name: "",
      account_number: "",
      balance_after: "",
      category: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (transaction: BankTransaction) => {
    setEditor({
      id: transaction.id,
      transaction_date: transaction.transaction_date.slice(0, 16),
      type: transaction.type,
      amount: String(transaction.amount),
      description: transaction.description ?? "",
      bank_name: transaction.bank_name ?? "",
      account_number: transaction.account_number ?? "",
      balance_after: transaction.balance_after === null ? "" : String(transaction.balance_after),
      category: transaction.category ?? "",
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const amount = Number(editor.amount);
    const balanceAfter = editor.balance_after.trim() === "" ? null : Number(editor.balance_after);

    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("금액을 올바르게 입력해주세요.");
      return;
    }
    if (balanceAfter !== null && (!Number.isFinite(balanceAfter) || balanceAfter < 0)) {
      toast.error("잔액을 올바르게 입력해주세요.");
      return;
    }

    const payload = {
      transaction_date: new Date(editor.transaction_date).toISOString(),
      type: editor.type,
      amount,
      description: editor.description,
      bank_name: editor.bank_name,
      account_number: editor.account_number,
      balance_after: balanceAfter,
      category: editor.category || null,
    };

    if (editor.id) {
      const result = await updateBankTransaction(editor.id, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    } else {
      const result = await createBankTransaction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    }

    toast.success(editor.id ? "입출금 내역을 수정했습니다." : "입출금 내역을 등록했습니다.");
    setEditorOpen(false);
    await refreshQueries();
  };

  const handleDelete = async (transactionId: string) => {
    const result = await deleteBankTransaction(transactionId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("입출금 내역을 삭제했습니다.");
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
        <p className="text-sm text-[var(--color-danger)]">입출금 데이터를 불러오지 못했습니다.</p>
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
          <p className="text-xs text-[var(--color-ink-muted)]">총 입금액</p>
          <p className="display-font mt-1 text-2xl text-[var(--color-brand)]">{formatCurrency(summary.depositTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">총 출금액</p>
          <p className="display-font mt-1 text-2xl text-[var(--color-warning)]">{formatCurrency(summary.withdrawalTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">순잔액</p>
          <p className={`display-font mt-1 text-2xl ${summary.netBalance >= 0 ? "text-[var(--color-brand-2)]" : "text-[var(--color-danger)]"}`}>
            {formatCurrency(summary.netBalance)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
            {[
              { id: "all" as const, label: "전체" },
              { id: "deposit" as const, label: "입금" },
              { id: "withdrawal" as const, label: "출금" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  typeFilter === tab.id ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 거래 등록
          </Button>
        </div>

        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>거래일</TH>
                <TH>유형</TH>
                <TH className="text-right">금액</TH>
                <TH>적요</TH>
                <TH>은행명</TH>
                <TH>계좌번호</TH>
                <TH className="text-right">잔액</TH>
                <TH className="w-[120px] text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {filteredTransactions.map((transaction) => (
                <TR key={transaction.id}>
                  <TD>{transaction.transaction_date.slice(0, 10)}</TD>
                  <TD>
                    <Badge tone={transaction.type === "deposit" ? "brand" : "warning"}>{TYPE_LABEL[transaction.type]}</Badge>
                  </TD>
                  <TD className={`text-right font-semibold ${transaction.type === "deposit" ? "text-[var(--color-brand)]" : "text-[var(--color-warning)]"}`}>
                    {formatCurrency(transaction.amount)}
                  </TD>
                  <TD>
                    <div>
                      <p>{transaction.description ?? "-"}</p>
                      {transaction.category ? <p className="text-xs text-[var(--color-ink-muted)]">{transaction.category}</p> : null}
                    </div>
                  </TD>
                  <TD>{transaction.bank_name ?? "-"}</TD>
                  <TD>{transaction.account_number ?? "-"}</TD>
                  <TD className="text-right">{transaction.balance_after === null ? "-" : formatCurrency(transaction.balance_after)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(transaction)}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(transaction.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {filteredTransactions.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 입출금 내역이 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "거래 수정" : "거래 등록"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              value={editor.transaction_date}
              onChange={(event) => setEditor((prev) => ({ ...prev, transaction_date: event.target.value }))}
            />
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={editor.type}
              onChange={(event) => setEditor((prev) => ({ ...prev, type: event.target.value as BankTransactionType }))}
            >
              <option value="deposit">입금</option>
              <option value="withdrawal">출금</option>
            </select>
          </div>

          <Input
            type="number"
            min={0}
            value={editor.amount}
            onChange={(event) => setEditor((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="금액"
          />

          <Input
            value={editor.description}
            onChange={(event) => setEditor((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="적요"
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={editor.bank_name}
              onChange={(event) => setEditor((prev) => ({ ...prev, bank_name: event.target.value }))}
              placeholder="은행명"
            />
            <Input
              value={editor.account_number}
              onChange={(event) => setEditor((prev) => ({ ...prev, account_number: event.target.value }))}
              placeholder="계좌번호"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              value={editor.balance_after}
              onChange={(event) => setEditor((prev) => ({ ...prev, balance_after: event.target.value }))}
              placeholder="거래 후 잔액"
            />
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={editor.category}
              onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value as BankTransactionCategory | "" }))}
            >
              <option value="">카테고리 선택</option>
              {BANK_TRANSACTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              취소
            </Button>
            <Button onClick={() => void handleSave()}>저장</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
