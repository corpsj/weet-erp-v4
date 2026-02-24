"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createTaxInvoice,
  deleteTaxInvoice,
  updateTaxInvoice,
  updateTaxInvoiceStatus,
} from "@/lib/api/actions/tax-invoices";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useTaxInvoices } from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { TaxInvoice, TaxInvoiceStatus, TaxInvoiceType } from "@/types/tax-invoice";

type TypeFilter = "all" | TaxInvoiceType;
type StatusFilter = "all" | TaxInvoiceStatus;
type MonthFilter = "all" | string;

type EditorState = {
  id?: string;
  type: TaxInvoiceType;
  issue_date: string;
  supplier_name: string;
  supplier_biz_no: string;
  receiver_name: string;
  receiver_biz_no: string;
  supply_amount: string;
  tax_amount: string;
  total_amount: string;
  description: string;
  status: TaxInvoiceStatus;
};

const TYPE_LABEL: Record<TaxInvoiceType, string> = {
  sales: "매출",
  purchase: "매입",
};

const STATUS_LABEL: Record<TaxInvoiceStatus, string> = {
  issued: "발행",
  cancelled: "취소",
};

const DEFAULT_EDITOR_STATE: EditorState = {
  type: "sales",
  issue_date: new Date().toISOString().slice(0, 10),
  supplier_name: "",
  supplier_biz_no: "",
  receiver_name: "",
  receiver_biz_no: "",
  supply_amount: "",
  tax_amount: "",
  total_amount: "",
  description: "",
  status: "issued",
};

export function TaxInvoicesWorkspace() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [monthFilter, setMonthFilter] = useState<MonthFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

  const { data: invoices, isLoading, isError, refetch } = useTaxInvoices();

  useEffect(() => {
    void markMenuAsRead("tax_invoices");
  }, []);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    for (const invoice of invoices ?? []) {
      months.add(invoice.issue_date.slice(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const base = invoices ?? [];
    const keyword = searchQuery.trim().toLowerCase();

    return base.filter((invoice) => {
      if (typeFilter !== "all" && invoice.type !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && invoice.status !== statusFilter) {
        return false;
      }
      if (monthFilter !== "all" && !invoice.issue_date.startsWith(monthFilter)) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      const haystack = [
        invoice.supplier_name,
        invoice.receiver_name,
        invoice.supplier_biz_no,
        invoice.receiver_biz_no,
        invoice.description ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [invoices, monthFilter, searchQuery, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    const issuedOnly = filteredInvoices.filter((item) => item.status === "issued");
    const sales = issuedOnly.filter((item) => item.type === "sales");
    const purchases = issuedOnly.filter((item) => item.type === "purchase");
    const salesTotal = sales.reduce((sum, item) => sum + item.total_amount, 0);
    const purchaseTotal = purchases.reduce((sum, item) => sum + item.total_amount, 0);
    const salesVat = sales.reduce((sum, item) => sum + item.tax_amount, 0);
    const purchaseVat = purchases.reduce((sum, item) => sum + item.tax_amount, 0);
    const grossAmount = filteredInvoices.reduce((sum, item) => sum + item.total_amount, 0);

    return {
      salesTotal,
      purchaseTotal,
      vatBalance: salesVat - purchaseVat,
      grossAmount,
      count: filteredInvoices.length,
      issuedCount: issuedOnly.length,
    };
  }, [filteredInvoices]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tax-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const applyVatAutoCalc = (supplyText: string) => {
    const supply = Number(supplyText);
    if (!Number.isFinite(supply) || supply < 0) {
      setEditor((prev) => ({ ...prev, supply_amount: supplyText, tax_amount: "", total_amount: "" }));
      return;
    }

    const tax = Math.round(supply * 0.1);
    const total = supply + tax;
    setEditor((prev) => ({
      ...prev,
      supply_amount: supplyText,
      tax_amount: String(tax),
      total_amount: String(total),
    }));
  };

  const openCreate = () => {
    setEditor(DEFAULT_EDITOR_STATE);
    setEditorOpen(true);
  };

  const openEdit = (invoice: TaxInvoice) => {
    setEditor({
      id: invoice.id,
      type: invoice.type,
      issue_date: invoice.issue_date,
      supplier_name: invoice.supplier_name,
      supplier_biz_no: invoice.supplier_biz_no,
      receiver_name: invoice.receiver_name,
      receiver_biz_no: invoice.receiver_biz_no,
      supply_amount: String(invoice.supply_amount),
      tax_amount: String(invoice.tax_amount),
      total_amount: String(invoice.total_amount),
      description: invoice.description ?? "",
      status: invoice.status,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    const supply = Number(editor.supply_amount);
    const tax = Number(editor.tax_amount);
    const total = Number(editor.total_amount);

    if (!editor.supplier_name.trim() || !editor.receiver_name.trim()) {
      toast.error("공급자명과 공급받는자명을 입력해주세요.");
      return;
    }
    if (![supply, tax, total].every((value) => Number.isFinite(value) && value >= 0)) {
      toast.error("금액 입력값을 확인해주세요.");
      return;
    }

    const payload = {
      type: editor.type,
      issue_date: editor.issue_date,
      supplier_name: editor.supplier_name.trim(),
      supplier_biz_no: editor.supplier_biz_no.trim(),
      receiver_name: editor.receiver_name.trim(),
      receiver_biz_no: editor.receiver_biz_no.trim(),
      supply_amount: supply,
      tax_amount: tax,
      total_amount: total,
      description: editor.description.trim(),
      status: editor.status,
    };

    setIsSaving(true);
    try {
      if (editor.id) {
        const result = await updateTaxInvoice(editor.id, payload);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      } else {
        const result = await createTaxInvoice(payload);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      }

      toast.success(editor.id ? "세금계산서를 수정했습니다." : "세금계산서를 등록했습니다.");
      setEditorOpen(false);
      await refreshQueries();
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (invoice: TaxInvoice) => {
    const next: TaxInvoiceStatus = invoice.status === "issued" ? "cancelled" : "issued";
    setBusyInvoiceId(invoice.id);
    const result = await updateTaxInvoiceStatus(invoice.id, next);
    if (!result.ok) {
      toast.error(result.message);
      setBusyInvoiceId(null);
      return;
    }
    toast.success(next === "issued" ? "발행 상태로 변경했습니다." : "취소 상태로 변경했습니다.");
    await refreshQueries();
    setBusyInvoiceId(null);
  };

  const handleDelete = async (invoiceId: string) => {
    if (!window.confirm("선택한 세금계산서를 삭제하시겠습니까?")) {
      return;
    }

    setBusyInvoiceId(invoiceId);
    const result = await deleteTaxInvoice(invoiceId);
    if (!result.ok) {
      toast.error(result.message);
      setBusyInvoiceId(null);
      return;
    }
    toast.success("세금계산서를 삭제했습니다.");
    await refreshQueries();
    setBusyInvoiceId(null);
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
        <p className="text-sm text-[var(--color-danger)]">세금계산서 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">매출 합계 (발행)</p>
          <p className="mt-1 text-2xl font-semibold text-[#ffffff]">{formatCurrency(summary.salesTotal)}</p>
        </Card>
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">매입 합계 (발행)</p>
          <p className="mt-1 text-2xl font-semibold text-[#e5e5e5]">{formatCurrency(summary.purchaseTotal)}</p>
        </Card>
        <Card className="border-[#2a2a2a] bg-[#141414] p-4">
          <p className="text-xs text-[#9a9a9a]">VAT 잔액 (발행)</p>
          <p className={`mt-1 text-2xl font-semibold ${summary.vatBalance >= 0 ? "text-[#ffffff]" : "text-[#ff4d6d]"}`}>
            {formatCurrency(summary.vatBalance)}
          </p>
        </Card>
      </div>

      <Card className="border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="공급자/수취자/사업자번호/적요 검색"
                className="pl-9"
              />
            </div>
            <select
              className="h-11 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-sm text-[#e5e5e5]"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="all">전체 월</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-1">
              {[
                { id: "all" as const, label: "전체" },
                { id: "issued" as const, label: "발행" },
                { id: "cancelled" as const, label: "취소" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-lg px-2 py-1.5 text-xs transition sm:px-3 ${
                    statusFilter === tab.id ? "bg-[#2a2a2a] text-[#ffffff]" : "text-[#9a9a9a]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={openCreate} className="w-full lg:w-auto">
            <Plus className="mr-1 h-4 w-4" /> 세금계산서 등록
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-1">
            {[
              { id: "all" as const, label: "전체" },
              { id: "sales" as const, label: "매출" },
              { id: "purchase" as const, label: "매입" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  typeFilter === tab.id ? "bg-[#2a2a2a] text-[#ffffff]" : "text-[#9a9a9a]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Badge className="border-[#2a2a2a] bg-[#0a0a0a] text-[#d4d4d4]">
            조회 건수 {summary.count}건 / 발행 {summary.issuedCount}건
          </Badge>
          <Badge className="border-[#2a2a2a] bg-[#0a0a0a] text-[#d4d4d4]">선택 합계 {formatCurrency(summary.grossAmount)}</Badge>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-[#2a2a2a]">
          <Table>
            <THead>
              <TR className="bg-[#1a1a1a]">
                <TH>유형</TH>
                <TH>발행일</TH>
                <TH>공급자명</TH>
                <TH>공급받는자명</TH>
                <TH>사업자번호</TH>
                <TH className="text-right">공급가액</TH>
                <TH className="text-right">세액</TH>
                <TH className="text-right">합계액</TH>
                <TH>상태</TH>
                <TH>적요</TH>
                <TH className="w-[120px] text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {filteredInvoices.map((invoice) => (
                <TR key={invoice.id} className="border-[#2a2a2a] bg-[#141414]">
                  <TD>
                    <Badge className={invoice.type === "sales" ? "border-[#3a3a3a] bg-[#2a2a2a] text-[#ffffff]" : "border-[#3a3a3a] bg-[#1a1a1a] text-[#d4d4d4]"}>
                      {TYPE_LABEL[invoice.type]}
                    </Badge>
                  </TD>
                  <TD>{invoice.issue_date}</TD>
                  <TD>{invoice.supplier_name}</TD>
                  <TD>{invoice.receiver_name}</TD>
                  <TD className="text-[#b0b0b0]">
                    {invoice.supplier_biz_no || "-"} / {invoice.receiver_biz_no || "-"}
                  </TD>
                  <TD className="text-right font-semibold text-[#e5e5e5]">
                    {formatCurrency(invoice.supply_amount)}
                  </TD>
                  <TD className="text-right text-[#d4d4d4]">{formatCurrency(invoice.tax_amount)}</TD>
                  <TD className="text-right font-medium text-[#ffffff]">{formatCurrency(invoice.total_amount)}</TD>
                  <TD>
                    <button
                      type="button"
                      onClick={() => void handleToggleStatus(invoice)}
                      disabled={busyInvoiceId === invoice.id}
                      className="disabled:opacity-50"
                    >
                      <Badge
                        className={
                          invoice.status === "issued"
                            ? "border-[#3a3a3a] bg-[#2a2a2a] text-[#ffffff]"
                            : "border-[#ff4d6d] bg-[#1a1a1a] text-[#ff4d6d]"
                        }
                      >
                        {STATUS_LABEL[invoice.status]}
                      </Badge>
                    </button>
                  </TD>
                  <TD className="max-w-[280px] truncate text-[#b0b0b0]">{invoice.description ?? "-"}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(invoice)} disabled={busyInvoiceId === invoice.id}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-[#ff4d6d] hover:text-[#ff4d6d]"
                        onClick={() => void handleDelete(invoice.id)}
                        disabled={busyInvoiceId === invoice.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {filteredInvoices.length === 0 ? (
          <p className="mt-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">
            검색 조건에 맞는 세금계산서가 없습니다.
          </p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "세금계산서 수정" : "세금계산서 등록"}>
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">유형</span>
              <select
                className="h-11 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-sm text-[#e5e5e5]"
                value={editor.type}
                onChange={(event) => setEditor((prev) => ({ ...prev, type: event.target.value as TaxInvoiceType }))}
              >
                <option value="sales">매출</option>
                <option value="purchase">매입</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">발행일</span>
              <Input
                type="date"
                value={editor.issue_date}
                onChange={(event) => setEditor((prev) => ({ ...prev, issue_date: event.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">공급자명</span>
              <Input
                value={editor.supplier_name}
                onChange={(event) => setEditor((prev) => ({ ...prev, supplier_name: event.target.value }))}
                placeholder="공급자명"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">공급자 사업자번호</span>
              <Input
                value={editor.supplier_biz_no}
                onChange={(event) => setEditor((prev) => ({ ...prev, supplier_biz_no: event.target.value }))}
                placeholder="000-00-00000"
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">공급받는자명</span>
              <Input
                value={editor.receiver_name}
                onChange={(event) => setEditor((prev) => ({ ...prev, receiver_name: event.target.value }))}
                placeholder="공급받는자명"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">공급받는자 사업자번호</span>
              <Input
                value={editor.receiver_biz_no}
                onChange={(event) => setEditor((prev) => ({ ...prev, receiver_biz_no: event.target.value }))}
                placeholder="000-00-00000"
              />
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">공급가액</span>
              <Input
                type="number"
                min={0}
                value={editor.supply_amount}
                onChange={(event) => applyVatAutoCalc(event.target.value)}
                placeholder="0"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">세액 (자동 10%)</span>
              <Input type="number" value={editor.tax_amount} readOnly placeholder="0" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-[#b0b0b0]">합계액</span>
              <Input type="number" value={editor.total_amount} readOnly placeholder="0" />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="text-[#b0b0b0]">상태</span>
            <select
              className="h-11 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-sm text-[#e5e5e5]"
              value={editor.status}
              onChange={(event) => setEditor((prev) => ({ ...prev, status: event.target.value as TaxInvoiceStatus }))}
            >
              <option value="issued">발행</option>
              <option value="cancelled">취소</option>
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-[#b0b0b0]">적요</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#3a3a3a]"
              value={editor.description}
              onChange={(event) => setEditor((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="거래 메모를 입력하세요"
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-[#2a2a2a] pt-3">
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={isSaving}>
              취소
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
