"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle2, Eye, LoaderCircle, Plus, SquarePen, Trash2, UploadCloud, FileText, Activity } from "lucide-react";
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

function GrokModal({ open, onClose, title, children }: { open: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/90 backdrop-blur-none p-4 overflow-y-auto">
      <div className="bg-[#141414] border border-[#3a3a3a] w-full max-w-lg shadow-none flex flex-col my-auto">
        <div className="flex justify-between items-center p-4 border-b border-[#2a2a2a]">
          <h2 className="text-[#ffffff] font-bold tracking-widest uppercase text-sm">{title}</h2>
          <button onClick={onClose} className="text-[#9a9a9a] hover:text-[#ffffff] transition-colors">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
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

  const thisMonthPaidAmount = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return (bills ?? [])
      .filter(b => b.is_paid && b.billing_month === currentMonth)
      .reduce((sum, b) => sum + b.amount, 0);
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
      const formData = new FormData();
      formData.append("file", billImageFile);
      const uploadResult = await uploadUtilityBillImage(formData);
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
      <div className="bg-[#0a0a0a] min-h-screen p-6 flex flex-col gap-4">
        <div className="h-24 bg-[#141414] border border-[#2a2a2a] animate-pulse" />
        <div className="h-96 bg-[#141414] border border-[#2a2a2a] animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-[#0a0a0a] min-h-screen p-6">
        <div className="bg-[#141414] border border-[#ff4d6d] p-6 text-center">
          <p className="text-[#ff4d6d] font-mono text-sm uppercase tracking-wider mb-4">Failed to load utility records.</p>
          <button className="bg-[#1a1a1a] border border-[#3a3a3a] text-[#ffffff] px-6 py-2 text-sm uppercase tracking-wider hover:bg-[#2a2a2a] transition-colors" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-[#ffffff] p-6 font-mono selection:bg-[#ffffff] selection:text-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#2a2a2a]">
        <h1 className="text-xl font-bold tracking-widest uppercase">Utility Operations</h1>
        <button 
          className="bg-[#ffffff] text-[#0a0a0a] px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-[#e5e5e5] transition-colors uppercase tracking-wider" 
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" /> New Record
        </button>
      </div>

      {/* Monthly Trend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#141414] border border-[#2a2a2a] p-5 flex flex-col">
          <span className="text-[#9a9a9a] text-xs uppercase tracking-widest mb-3">Total Unpaid</span>
          <span className="text-[#ff4d6d] text-3xl font-bold">{summary.count} Bills</span>
          <span className="text-[#ff4d6d] text-sm mt-2">{formatCurrency(summary.amount)} KRW</span>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] p-5 flex flex-col">
          <span className="text-[#9a9a9a] text-xs uppercase tracking-widest mb-3">Paid This Month</span>
          <span className="text-[#ffffff] text-3xl font-bold">{formatCurrency(thisMonthPaidAmount)}</span>
          <span className="text-[#9a9a9a] text-sm mt-2">KRW</span>
        </div>
        <div className="bg-[#141414] border border-[#2a2a2a] p-5 flex flex-col justify-center">
          <span className="text-[#9a9a9a] text-xs uppercase tracking-widest mb-3">Category Filter</span>
          <div className="flex gap-2 flex-wrap">
            {["all", ...UTILITY_CATEGORIES].map(cat => (
               <button 
                 key={cat}
                 onClick={() => setCategoryFilter(cat as UtilityCategoryFilter)}
                 className={`px-3 py-1 text-xs uppercase tracking-wider border transition-colors ${categoryFilter === cat ? 'bg-[#ffffff] text-[#0a0a0a] border-[#ffffff]' : 'bg-[#1a1a1a] text-[#b0b0b0] border-[#2a2a2a] hover:bg-[#2a2a2a] hover:text-[#ffffff]'}`}
               >
                 {cat === "all" ? "ALL" : cat}
               </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="w-full overflow-x-auto border border-[#2a2a2a] bg-[#141414]">
        <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[#3a3a3a] bg-[#1a1a1a]">
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest">Category</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest">Month</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest text-right">Amount</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest text-center">Status</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest text-center">Receipt</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest w-full min-w-[200px]">Memo (Auto-save)</th>
              <th className="p-4 text-[#b0b0b0] font-normal uppercase text-xs tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map(bill => (
              <tr key={bill.id} className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a] transition-colors group">
                <td className="p-4 text-[#ffffff] font-medium">{bill.category}</td>
                <td className="p-4 text-[#d4d4d4]">{bill.billing_month}</td>
                <td className="p-4 text-[#ffffff] text-right">{formatCurrency(bill.amount)}</td>
                <td className="p-4 text-center">
                  <button onClick={() => void handleTogglePaid(bill)} className={`px-2 py-1 text-[10px] uppercase tracking-widest border transition-colors ${bill.is_paid ? 'bg-[#1a1a1a] text-[#9a9a9a] border-[#3a3a3a] hover:border-[#9a9a9a]' : 'bg-[#ff4d6d]/10 text-[#ff4d6d] border-[#ff4d6d] font-bold hover:bg-[#ff4d6d]/20'}`}>
                    {bill.is_paid ? 'Paid' : 'Unpaid'}
                  </button>
                </td>
                <td className="p-4 text-center">
                   {bill.image_path ? (
                      <button onClick={() => void handleOpenImage(bill.image_path)} className="text-[#d4d4d4] hover:text-[#ffffff] mx-auto block transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                   ) : (
                      <span className="text-[#3a3a3a]">-</span>
                   )}
                </td>
                <td className="p-4">
                   <input 
                     type="text"
                     value={memoDrafts[bill.id] ?? ""}
                     onChange={(e) => setMemoDrafts(prev => ({...prev, [bill.id]: e.target.value}))}
                     className="w-full bg-transparent border-b border-transparent focus:border-[#3a3a3a] text-[#d4d4d4] p-1 outline-none transition-colors"
                     placeholder="Add memo..."
                   />
                </td>
                <td className="p-4 text-right">
                   <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(bill)} className="text-[#9a9a9a] hover:text-[#ffffff] transition-colors"><SquarePen className="w-4 h-4" /></button>
                      <button onClick={() => void handleDelete(bill.id)} className="text-[#9a9a9a] hover:text-[#ff4d6d] transition-colors"><Trash2 className="w-4 h-4" /></button>
                   </div>
                </td>
              </tr>
            ))}
            {filteredBills.length === 0 && (
              <tr>
                <td colSpan={7} className="p-12 text-center text-[#9a9a9a] uppercase tracking-widest text-xs">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <GrokModal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "Edit Record" : "New Record"}>
        <div className="space-y-6">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-[#0a0a0a] border border-[#2a2a2a]">
            <button 
              onClick={() => setEditorMode("manual")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${editorMode === 'manual' ? 'bg-[#ffffff] text-[#0a0a0a]' : 'text-[#b0b0b0] hover:text-[#ffffff]'}`}
            >
              Manual Input
            </button>
            <button 
              onClick={() => setEditorMode("ai")}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider flex justify-center items-center gap-2 transition-colors ${editorMode === 'ai' ? 'bg-[#ffffff] text-[#0a0a0a]' : 'text-[#b0b0b0] hover:text-[#ffffff]'}`}
            >
              <Bot className="w-4 h-4" /> AI Analysis
            </button>
          </div>

          {/* AI Analysis Form */}
          {editorMode === "ai" && (
            <div className="border border-[#2a2a2a] bg-[#0a0a0a] p-4">
              <div className="mb-4">
                <label className="block text-[#b0b0b0] text-xs uppercase tracking-widest mb-2">Upload Receipt</label>
                <div className="border-2 border-dashed border-[#3a3a3a] p-8 text-center hover:border-[#ffffff] transition-colors relative cursor-pointer bg-[#141414]">
                   <input type="file" accept="image/*" onChange={(e) => setBillImageFile(e.target.files?.[0] ?? null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                   {billImageFile ? (
                     <div className="flex flex-col items-center">
                       <FileText className="w-8 h-8 text-[#ffffff] mb-3" />
                       <span className="text-[#ffffff] text-sm font-medium">{billImageFile.name}</span>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center">
                       <UploadCloud className="w-8 h-8 text-[#9a9a9a] mb-3" />
                       <span className="text-[#9a9a9a] text-sm">Click or drag image here</span>
                     </div>
                   )}
                </div>
              </div>
              <button 
                onClick={() => void handleAnalyze()} 
                disabled={analyzing}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] text-[#ffffff] py-3 text-sm font-bold uppercase tracking-widest hover:bg-[#2a2a2a] flex justify-center items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {analyzing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                {analyzing ? "ANALYZING..." : "RUN AI ANALYSIS"}
              </button>

              {/* Analysis Results Display */}
              {editor.processing_status === "processed" && (
                <div className="mt-4 p-4 border border-[#ffffff] bg-[#141414]">
                   <h3 className="text-[#ffffff] text-xs uppercase tracking-widest font-bold mb-4 flex items-center gap-2">
                     <CheckCircle2 className="w-4 h-4 text-[#ffffff]" /> Analysis Complete
                   </h3>
                   <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                     <div><span className="text-[#9a9a9a] block text-[10px] uppercase tracking-widest mb-1">Category</span><span className="text-[#ffffff] font-medium">{editor.category}</span></div>
                     <div><span className="text-[#9a9a9a] block text-[10px] uppercase tracking-widest mb-1">Month</span><span className="text-[#ffffff] font-medium">{editor.billing_month}</span></div>
                     <div className="col-span-2"><span className="text-[#9a9a9a] block text-[10px] uppercase tracking-widest mb-1">Amount</span><span className="text-[#ffffff] text-xl font-bold">{formatCurrency(Number(editor.amount))} KRW</span></div>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Form */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#b0b0b0] text-xs uppercase tracking-widest mb-2">Category</label>
                <select 
                  value={editor.category} 
                  onChange={e => setEditor(prev => ({...prev, category: e.target.value as UtilityCategory}))}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#ffffff] p-3 text-sm focus:border-[#ffffff] outline-none transition-colors appearance-none"
                >
                  {UTILITY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#b0b0b0] text-xs uppercase tracking-widest mb-2">Billing Month</label>
                <input 
                  type="month" 
                  value={editor.billing_month} 
                  onChange={e => setEditor(prev => ({...prev, billing_month: e.target.value}))}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#ffffff] p-3 text-sm focus:border-[#ffffff] outline-none transition-colors [color-scheme:dark]"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[#b0b0b0] text-xs uppercase tracking-widest mb-2">Amount (KRW)</label>
              <input 
                type="number" 
                min={0}
                value={editor.amount} 
                onChange={e => setEditor(prev => ({...prev, amount: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#ffffff] p-4 text-xl font-bold focus:border-[#ffffff] outline-none transition-colors placeholder:text-[#3a3a3a]"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-[#b0b0b0] text-xs uppercase tracking-widest mb-2">Memo (Optional)</label>
              <textarea 
                value={editor.memo} 
                onChange={e => setEditor(prev => ({...prev, memo: e.target.value}))}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] text-[#ffffff] p-3 text-sm min-h-[100px] focus:border-[#ffffff] outline-none resize-none transition-colors placeholder:text-[#3a3a3a]"
                placeholder="Add notes..."
              />
            </div>

            <label className="flex items-center gap-3 p-4 border border-[#2a2a2a] bg-[#0a0a0a] cursor-pointer hover:border-[#3a3a3a] transition-colors">
              <input 
                type="checkbox" 
                checked={editor.is_paid} 
                onChange={e => setEditor(prev => ({...prev, is_paid: e.target.checked}))}
                className="w-5 h-5 accent-[#ffffff] bg-[#0a0a0a] border-[#2a2a2a] cursor-pointer"
              />
              <span className="text-[#ffffff] text-sm uppercase tracking-widest font-bold">Mark as Paid</span>
            </label>
          </div>

          <div className="flex gap-3 pt-6 border-t border-[#2a2a2a]">
            <button onClick={() => setEditorOpen(false)} className="flex-1 py-4 border border-[#2a2a2a] text-[#ffffff] text-xs tracking-widest font-bold uppercase hover:bg-[#1a1a1a] transition-colors">
              Cancel
            </button>
            <button onClick={() => void handleSave()} className="flex-1 py-4 bg-[#ffffff] text-[#0a0a0a] text-xs tracking-widest font-bold uppercase hover:bg-[#e5e5e5] flex justify-center items-center gap-2 transition-colors">
              <CheckCircle2 className="w-4 h-4" /> Save Record
            </button>
          </div>
        </div>
      </GrokModal>
    </div>
  );
}
