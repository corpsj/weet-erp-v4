"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, SquarePen, Trash2 } from "lucide-react";
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

export function TaxInvoicesWorkspace() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
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
  });

  const { data: invoices, isLoading, isError, refetch } = useTaxInvoices();

  useEffect(() => {
    void markMenuAsRead("tax_invoices");
  }, []);

  const filteredInvoices = useMemo(() => {
    const base = invoices ?? [];
    if (typeFilter === "all") return base;
    return base.filter((invoice) => invoice.type === typeFilter);
  }, [invoices, typeFilter]);

  const summary = useMemo(() => {
    const valid = (invoices ?? []).filter((item) => item.status === "issued");
    const sales = valid.filter((item) => item.type === "sales");
    const purchases = valid.filter((item) => item.type === "purchase");
    const salesTotal = sales.reduce((sum, item) => sum + item.total_amount, 0);
    const purchaseTotal = purchases.reduce((sum, item) => sum + item.total_amount, 0);
    const salesVat = sales.reduce((sum, item) => sum + item.tax_amount, 0);
    const purchaseVat = purchases.reduce((sum, item) => sum + item.tax_amount, 0);

    return {
      salesTotal,
      purchaseTotal,
      vatBalance: salesVat - purchaseVat,
    };
  }, [invoices]);

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

    const tax = Math.floor(supply * 0.1);
    const total = supply + tax;
    setEditor((prev) => ({
      ...prev,
      supply_amount: supplyText,
      tax_amount: String(tax),
      total_amount: String(total),
    }));
  };

  const openCreate = () => {
    setEditor({
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
    });
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
      supplier_name: editor.supplier_name,
      supplier_biz_no: editor.supplier_biz_no,
      receiver_name: editor.receiver_name,
      receiver_biz_no: editor.receiver_biz_no,
      supply_amount: supply,
      tax_amount: tax,
      total_amount: total,
      description: editor.description,
      status: editor.status,
    };

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
  };

  const handleToggleStatus = async (invoice: TaxInvoice) => {
    const next: TaxInvoiceStatus = invoice.status === "issued" ? "cancelled" : "issued";
    const result = await updateTaxInvoiceStatus(invoice.id, next);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(next === "issued" ? "발행 상태로 변경했습니다." : "취소 상태로 변경했습니다.");
    await refreshQueries();
  };

  const handleDelete = async (invoiceId: string) => {
    const result = await deleteTaxInvoice(invoiceId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("세금계산서를 삭제했습니다.");
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
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">매출 합계</p>
          <p className="display-font mt-1 text-2xl text-[var(--color-brand)]">{formatCurrency(summary.salesTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">매입 합계</p>
          <p className="display-font mt-1 text-2xl text-[var(--color-warning)]">{formatCurrency(summary.purchaseTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">VAT 잔액</p>
          <p className={`display-font mt-1 text-2xl ${summary.vatBalance >= 0 ? "text-[var(--color-brand-2)]" : "text-[var(--color-danger)]"}`}>
            {formatCurrency(summary.vatBalance)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
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
                  typeFilter === tab.id ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 세금계산서 등록
          </Button>
        </div>

        <div className="mt-4">
          <Table>
            <THead>
              <TR>
                <TH>유형</TH>
                <TH>발행일</TH>
                <TH>공급자명</TH>
                <TH>공급받는자명</TH>
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
                <TR key={invoice.id} className={invoice.type === "sales" ? "bg-[rgb(10_32_45/35%)]" : "bg-[rgb(36_28_15/20%)]"}>
                  <TD>
                    <Badge tone={invoice.type === "sales" ? "brand" : "warning"}>{TYPE_LABEL[invoice.type]}</Badge>
                  </TD>
                  <TD>{invoice.issue_date}</TD>
                  <TD>{invoice.supplier_name}</TD>
                  <TD>{invoice.receiver_name}</TD>
                  <TD className={`text-right font-semibold ${invoice.type === "sales" ? "text-[var(--color-brand)]" : "text-[var(--color-warning)]"}`}>
                    {formatCurrency(invoice.supply_amount)}
                  </TD>
                  <TD className="text-right">{formatCurrency(invoice.tax_amount)}</TD>
                  <TD className="text-right">{formatCurrency(invoice.total_amount)}</TD>
                  <TD>
                    <button type="button" onClick={() => void handleToggleStatus(invoice)}>
                      <Badge tone={invoice.status === "issued" ? "brand" : "danger"}>{STATUS_LABEL[invoice.status]}</Badge>
                    </button>
                  </TD>
                  <TD>{invoice.description ?? "-"}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(invoice)}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(invoice.id)}>
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
          <p className="mt-4 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 세금계산서가 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "세금계산서 수정" : "세금계산서 등록"}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={editor.type}
              onChange={(event) => setEditor((prev) => ({ ...prev, type: event.target.value as TaxInvoiceType }))}
            >
              <option value="sales">매출</option>
              <option value="purchase">매입</option>
            </select>
            <Input
              type="date"
              value={editor.issue_date}
              onChange={(event) => setEditor((prev) => ({ ...prev, issue_date: event.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={editor.supplier_name}
              onChange={(event) => setEditor((prev) => ({ ...prev, supplier_name: event.target.value }))}
              placeholder="공급자명"
            />
            <Input
              value={editor.supplier_biz_no}
              onChange={(event) => setEditor((prev) => ({ ...prev, supplier_biz_no: event.target.value }))}
              placeholder="공급자 사업자번호"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={editor.receiver_name}
              onChange={(event) => setEditor((prev) => ({ ...prev, receiver_name: event.target.value }))}
              placeholder="공급받는자명"
            />
            <Input
              value={editor.receiver_biz_no}
              onChange={(event) => setEditor((prev) => ({ ...prev, receiver_biz_no: event.target.value }))}
              placeholder="공급받는자 사업자번호"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              min={0}
              value={editor.supply_amount}
              onChange={(event) => applyVatAutoCalc(event.target.value)}
              placeholder="공급가액"
            />
            <Input type="number" value={editor.tax_amount} readOnly placeholder="세액" />
            <Input type="number" value={editor.total_amount} readOnly placeholder="합계액" />
          </div>

          <select
            className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
            value={editor.status}
            onChange={(event) => setEditor((prev) => ({ ...prev, status: event.target.value as TaxInvoiceStatus }))}
          >
            <option value="issued">발행</option>
            <option value="cancelled">취소</option>
          </select>

          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            value={editor.description}
            onChange={(event) => setEditor((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="적요"
          />

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
