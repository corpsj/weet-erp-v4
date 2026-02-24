"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, SquarePen, Trash2 } from "lucide-react";
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
type CategoryFilter = "all" | "uncategorized" | BankTransactionCategory;

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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
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

  const latestKnownBalance = useMemo(() => {
    const latest = (transactions ?? []).find((item) => item.balance_after !== null);
    return latest?.balance_after ?? null;
  }, [transactions]);

  useEffect(() => {
    void markMenuAsRead("bank_transactions");
  }, []);

  const filteredTransactions = useMemo(() => {
    const base = transactions ?? [];
    const query = search.trim().toLowerCase();

    return base.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      if (categoryFilter === "uncategorized" && item.category !== null) {
        return false;
      }
      if (categoryFilter !== "all" && categoryFilter !== "uncategorized" && item.category !== categoryFilter) {
        return false;
      }
      if (monthFilter && !item.transaction_date.startsWith(monthFilter)) {
        return false;
      }
      if (!query) {
        return true;
      }

      const searchable = [
        item.description ?? "",
        item.bank_name ?? "",
        item.account_number ?? "",
        item.category ?? "",
        formatCurrency(item.amount),
        item.transaction_date.slice(0, 10),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [transactions, typeFilter, categoryFilter, monthFilter, search]);

  const filteredSummary = useMemo(() => {
    const depositTotal = filteredTransactions.filter((item) => item.type === "deposit").reduce((sum, item) => sum + item.amount, 0);
    const withdrawalTotal = filteredTransactions
      .filter((item) => item.type === "withdrawal")
      .reduce((sum, item) => sum + item.amount, 0);

    const latestBalance = filteredTransactions.find((item) => item.balance_after !== null)?.balance_after ?? null;

    return {
      depositTotal,
      withdrawalTotal,
      netBalance: depositTotal - withdrawalTotal,
      latestBalance,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

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
      balance_after: latestKnownBalance === null ? "" : String(latestKnownBalance),
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
    const transactionDate = new Date(editor.transaction_date);
    const amount = Number(editor.amount);
    const balanceAfter = editor.balance_after.trim() === "" ? null : Number(editor.balance_after);

    if (Number.isNaN(transactionDate.getTime())) {
      toast.error("거래일을 올바르게 입력해주세요.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("금액을 올바르게 입력해주세요.");
      return;
    }
    if (balanceAfter !== null && (!Number.isFinite(balanceAfter) || balanceAfter < 0)) {
      toast.error("잔액을 올바르게 입력해주세요.");
      return;
    }

    const payload = {
      transaction_date: transactionDate.toISOString(),
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
    if (!window.confirm("선택한 거래를 삭제하시겠습니까?")) {
      return;
    }

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
        <p className="text-sm text-[#ff4d6d]">입출금 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">입금 합계</p>
          <p className="display-font mt-1 text-2xl text-[#ffffff]">{formatCurrency(filteredSummary.depositTotal)}</p>
        </Card>
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">출금 합계</p>
          <p className="display-font mt-1 text-2xl text-[#ff4d6d]">{formatCurrency(filteredSummary.withdrawalTotal)}</p>
        </Card>
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">순증감</p>
          <p className={`display-font mt-1 text-2xl ${filteredSummary.netBalance < 0 ? "text-[#ff4d6d]" : "text-[#ffffff]"}`}>
            {filteredSummary.netBalance < 0 ? "-" : "+"}
            {formatCurrency(Math.abs(filteredSummary.netBalance))}
          </p>
        </Card>
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">거래수 / 최신 잔액</p>
          <p className="display-font mt-1 text-2xl text-[#e5e5e5]">{filteredSummary.count.toLocaleString("ko-KR")}건</p>
          <p className="mt-1 text-xs text-[#b0b0b0]">
            {filteredSummary.latestBalance === null ? "잔액 정보 없음" : formatCurrency(filteredSummary.latestBalance)}
          </p>
        </Card>
      </div>

      <Card className="border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-1">
            {[
              { id: "all" as const, label: "전체" },
              { id: "deposit" as const, label: "입금" },
              { id: "withdrawal" as const, label: "출금" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  typeFilter === tab.id ? "bg-[#e5e5e5] text-[#0a0a0a]" : "text-[#9a9a9a]"
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

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <div className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="적요, 은행명, 계좌번호, 카테고리 검색"
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
            className="h-10 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-sm text-[#e5e5e5]"
          >
            <option value="all">전체 카테고리</option>
            <option value="uncategorized">미분류</option>
            {BANK_TRANSACTION_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <Input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="w-full md:w-[180px]" />
        </div>

        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>거래일</TH>
                <TH>유형</TH>
                <TH className="text-right">금액</TH>
                <TH>카테고리</TH>
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
                  <TD>{transaction.transaction_date.slice(0, 16).replace("T", " ")}</TD>
                  <TD>
                    <Badge tone={transaction.type === "withdrawal" ? "danger" : "neutral"} className={transaction.type === "deposit" ? "border-[#e5e5e5] text-[#ffffff]" : ""}>
                      {TYPE_LABEL[transaction.type]}
                    </Badge>
                  </TD>
                  <TD className={`text-right font-semibold ${transaction.type === "withdrawal" ? "text-[#ff4d6d]" : "text-[#ffffff]"}`}>
                    {formatCurrency(transaction.amount)}
                  </TD>
                  <TD>{transaction.category ?? "-"}</TD>
                  <TD>
                    <div>
                      <p>{transaction.description ?? "-"}</p>
                    </div>
                  </TD>
                  <TD>{transaction.bank_name ?? "-"}</TD>
                  <TD>{transaction.account_number ?? "-"}</TD>
                  <TD className="text-right text-[#d4d4d4]">{transaction.balance_after === null ? "-" : formatCurrency(transaction.balance_after)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(transaction)}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="h-8 px-2 text-[#ff4d6d] hover:bg-[#2a2a2a]" onClick={() => void handleDelete(transaction.id)}>
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
          <p className="mt-4 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-4 text-sm text-[#9a9a9a]">
            조건에 맞는 입출금 내역이 없습니다.
          </p>
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
              className="h-10 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-sm text-[#e5e5e5]"
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
              className="h-10 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-sm text-[#e5e5e5]"
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
