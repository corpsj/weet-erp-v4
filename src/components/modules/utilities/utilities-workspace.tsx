"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Eye, LoaderCircle, Plus, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  analyzeUtilityBill,
  createUtilityBill,
  deleteUtilityBill,
  getUtilityBillImageSignedUrl,
  toggleUtilityBillPaid,
  updateUtilityBill,
  updateUtilityBillMemo,
  uploadUtilityBillImage,
} from "@/lib/api/actions/utilities";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useUtilityBills } from "@/lib/api/hooks";
import { formatCurrency } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { UTILITY_CATEGORIES, type UtilityBill, type UtilityCategory, type UtilityProcessingStatus } from "@/types/utility";

type UtilityCategoryFilter = "all" | UtilityCategory;
type EditorMode = "manual" | "ai";

type EditorState = {
  id?: string;
  category: UtilityCategory;
  billing_month: string;
  amount: string;
  memo: string;
  is_paid: boolean;
  image_path: string | null;
  processing_status: UtilityProcessingStatus;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("이미지 변환 실패"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("이미지 변환 실패"));
    reader.readAsDataURL(file);
  });
}

export function UtilitiesWorkspace() {
  const queryClient = useQueryClient();
  const memoTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [categoryFilter, setCategoryFilter] = useState<UtilityCategoryFilter>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("manual");
  const [analyzing, setAnalyzing] = useState(false);
  const [billImageFile, setBillImageFile] = useState<File | null>(null);
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<EditorState>({
    category: "전기",
    billing_month: new Date().toISOString().slice(0, 7),
    amount: "",
    memo: "",
    is_paid: false,
    image_path: null,
    processing_status: "manual",
  });

  const { data: bills, isLoading, isError, refetch } = useUtilityBills();

  useEffect(() => {
    void markMenuAsRead("utilities");
  }, []);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    (bills ?? []).forEach((bill) => {
      nextDrafts[bill.id] = bill.memo ?? "";
    });
    setMemoDrafts(nextDrafts);
  }, [bills]);

  useEffect(() => {
    const list = bills ?? [];
    const timers = memoTimersRef.current;

    Object.entries(memoDrafts).forEach(([id, draft]) => {
      const source = list.find((item) => item.id === id);
      if (!source) return;
      if ((source.memo ?? "") === draft) return;

      const prev = timers.get(id);
      if (prev) {
        clearTimeout(prev);
      }

      const timer = setTimeout(async () => {
        const result = await updateUtilityBillMemo(id, draft);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["utility-bills"] });
      }, 1000);

      timers.set(id, timer);
    });

    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, [bills, memoDrafts, queryClient]);

  const filteredBills = useMemo(() => {
    const base = bills ?? [];
    if (categoryFilter === "all") return base;
    return base.filter((bill) => bill.category === categoryFilter);
  }, [bills, categoryFilter]);

  const summary = useMemo(() => {
    const unpaid = (bills ?? []).filter((bill) => !bill.is_paid);
    return {
      count: unpaid.length,
      amount: unpaid.reduce((sum, bill) => sum + bill.amount, 0),
    };
  }, [bills]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["utility-bills"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const openCreate = () => {
    setEditorMode("manual");
    setBillImageFile(null);
    setEditor({
      category: "전기",
      billing_month: new Date().toISOString().slice(0, 7),
      amount: "",
      memo: "",
      is_paid: false,
      image_path: null,
      processing_status: "manual",
    });
    setEditorOpen(true);
  };

  const openEdit = (bill: UtilityBill) => {
    setEditorMode(bill.processing_status === "processed" ? "ai" : "manual");
    setBillImageFile(null);
    setEditor({
      id: bill.id,
      category: bill.category,
      billing_month: bill.billing_month,
      amount: String(bill.amount),
      memo: bill.memo ?? "",
      is_paid: bill.is_paid,
      image_path: bill.image_path,
      processing_status: bill.processing_status,
    });
    setEditorOpen(true);
  };

  const handleAnalyze = async () => {
    if (!billImageFile) {
      toast.error("분석할 고지서 이미지를 먼저 선택해주세요.");
      return;
    }

    setAnalyzing(true);
    const base64 = await fileToBase64(billImageFile).catch(() => null);
    if (!base64) {
      toast.error("이미지 변환에 실패했습니다.");
      setAnalyzing(false);
      return;
    }

    const result = await analyzeUtilityBill(base64, billImageFile.type || "image/jpeg");
    setAnalyzing(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setEditor((prev) => ({
      ...prev,
      category: result.data.category,
      billing_month: result.data.billing_month,
      amount: String(result.data.amount),
      processing_status: "processed",
    }));
    toast.success("AI 분석 결과를 입력했습니다.");
  };

  const handleSave = async () => {
    const amount = Number(editor.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("금액을 올바르게 입력해주세요.");
      return;
    }

    let imagePath = editor.image_path;
    if (billImageFile) {
      const uploadResult = await uploadUtilityBillImage(billImageFile);
      if (!uploadResult.ok) {
        toast.error(uploadResult.message);
        return;
      }
      imagePath = uploadResult.data.filePath;
    }

    const payload = {
      category: editor.category,
      billing_month: editor.billing_month,
      amount,
      memo: editor.memo,
      image_path: imagePath,
      processing_status: editorMode === "ai" ? editor.processing_status : "manual",
      is_paid: editor.is_paid,
    };

    if (editor.id) {
      const result = await updateUtilityBill(editor.id, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    } else {
      const result = await createUtilityBill(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
    }

    toast.success(editor.id ? "공과금 내역을 수정했습니다." : "공과금을 등록했습니다.");
    setEditorOpen(false);
    await refreshQueries();
  };

  const handleTogglePaid = async (bill: UtilityBill) => {
    const result = await toggleUtilityBillPaid(bill.id, !bill.is_paid);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(!bill.is_paid ? "납부 완료로 변경했습니다." : "미납으로 변경했습니다.");
    await refreshQueries();
  };

  const handleDelete = async (billId: string) => {
    const result = await deleteUtilityBill(billId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("공과금 내역을 삭제했습니다.");
    await refreshQueries();
  };

  const handleOpenImage = async (imagePath: string | null) => {
    if (!imagePath) {
      toast.error("등록된 이미지가 없습니다.");
      return;
    }
    const result = await getUtilityBillImageSignedUrl(imagePath);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
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
        <p className="text-sm text-[var(--color-danger)]">공과금 데이터를 불러오지 못했습니다.</p>
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
          <p className="text-xs text-[var(--color-ink-muted)]">미납 건수</p>
          <p className="display-font mt-1 text-3xl">{summary.count}건</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--color-ink-muted)]">미납 총액</p>
          <p className="display-font mt-1 text-3xl text-[var(--color-warning)]">{formatCurrency(summary.amount)}</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
            {["all", ...UTILITY_CATEGORIES].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category as UtilityCategoryFilter)}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  categoryFilter === category ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {category === "all" ? "전체" : category}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 공과금 등록
          </Button>
        </div>

        <div className="mt-4 hidden lg:block">
          <Table>
            <THead>
              <TR>
                <TH>분류</TH>
                <TH>청구월</TH>
                <TH className="text-right">금액</TH>
                <TH>상태</TH>
                <TH>이미지</TH>
                <TH>메모 (1초 자동 저장)</TH>
                <TH className="w-[130px] text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {filteredBills.map((bill) => (
                <TR key={bill.id}>
                  <TD>{bill.category}</TD>
                  <TD>{bill.billing_month}</TD>
                  <TD className="text-right">{formatCurrency(bill.amount)}</TD>
                  <TD>
                    <button type="button" onClick={() => void handleTogglePaid(bill)}>
                      <Badge tone={bill.is_paid ? "brand" : "warning"}>{bill.is_paid ? "납부 완료" : "미납"}</Badge>
                    </button>
                  </TD>
                  <TD>
                    {bill.image_path ? (
                      <Button variant="ghost" className="h-8 px-2" onClick={() => void handleOpenImage(bill.image_path)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-muted)]">없음</span>
                    )}
                  </TD>
                  <TD>
                    <input
                      className="h-9 w-full rounded-lg border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-2 text-xs"
                      value={memoDrafts[bill.id] ?? ""}
                      onChange={(event) =>
                        setMemoDrafts((prev) => ({
                          ...prev,
                          [bill.id]: event.target.value,
                        }))
                      }
                      placeholder="메모 입력"
                    />
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(bill)}>
                        <SquarePen className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(bill.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <div className="mt-4 space-y-2 lg:hidden">
          {filteredBills.map((bill) => (
            <div key={bill.id} className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {bill.category} · {bill.billing_month}
                  </p>
                  <p className="display-font text-lg">{formatCurrency(bill.amount)}</p>
                </div>
                <button type="button" onClick={() => void handleTogglePaid(bill)}>
                  <Badge tone={bill.is_paid ? "brand" : "warning"}>{bill.is_paid ? "납부 완료" : "미납"}</Badge>
                </button>
              </div>
              <input
                className="mt-2 h-9 w-full rounded-lg border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-2 text-xs"
                value={memoDrafts[bill.id] ?? ""}
                onChange={(event) =>
                  setMemoDrafts((prev) => ({
                    ...prev,
                    [bill.id]: event.target.value,
                  }))
                }
                placeholder="메모 입력 (자동 저장)"
              />
              <div className="mt-2 flex justify-end gap-1">
                {bill.image_path ? (
                  <Button variant="ghost" className="h-8 px-2" onClick={() => void handleOpenImage(bill.image_path)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(bill)}>
                  <SquarePen className="h-4 w-4" />
                </Button>
                <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(bill.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredBills.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 공과금이 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "공과금 수정" : "공과금 등록"}>
        <div className="space-y-3">
          <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
            {[
              { id: "manual" as const, label: "수동 입력" },
              { id: "ai" as const, label: "AI 이미지 분석" },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setEditorMode(mode.id)}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  editorMode === mode.id ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-[rgb(42_42_42/45%)] p-3">
            <p className="text-xs text-[var(--color-ink-muted)]">고지서 이미지</p>
            <Input type="file" accept="image/*" onChange={(event) => setBillImageFile(event.target.files?.[0] ?? null)} />
            {billImageFile ? <p className="text-xs text-[var(--color-brand)]">{billImageFile.name}</p> : null}
            {editorMode === "ai" ? (
              <Button className="w-full" variant="outline" onClick={() => void handleAnalyze()} disabled={analyzing}>
                {analyzing ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}
                AI 분석 실행
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-11 rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={editor.category}
              onChange={(event) => setEditor((prev) => ({ ...prev, category: event.target.value as UtilityCategory }))}
            >
              {UTILITY_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <Input
              type="month"
              value={editor.billing_month}
              onChange={(event) => setEditor((prev) => ({ ...prev, billing_month: event.target.value }))}
            />
          </div>

          <Input
            type="number"
            min={0}
            value={editor.amount}
            onChange={(event) => setEditor((prev) => ({ ...prev, amount: event.target.value }))}
            placeholder="금액"
          />

          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />

          <label className="flex items-center gap-2 rounded-xl border border-[rgb(42_42_42/45%)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={editor.is_paid}
              onChange={(event) => setEditor((prev) => ({ ...prev, is_paid: event.target.checked }))}
            />
            납부 완료
          </label>

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
