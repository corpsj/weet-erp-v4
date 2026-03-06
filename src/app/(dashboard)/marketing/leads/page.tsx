"use client";

import { useState } from "react";
import { useMarketingLeads } from "@/lib/api/hooks";
import { LeadTable } from "@/components/modules/marketing/lead-table";

const STAGE_TABS = [
  { id: undefined, label: "전체" },
  { id: "awareness", label: "인지" },
  { id: "interest", label: "관심" },
  { id: "consideration", label: "고려" },
  { id: "conversion", label: "전환" },
] as const;

export default function LeadsPage() {
  const [stage, setStage] = useState<string | undefined>(undefined);
  const { data: leads, isLoading } = useMarketingLeads({ stage });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">수집된 리드</h1>
          <p className="text-[#9a9a9a] mt-1">플랫폼에서 수집된 잠재 고객 목록입니다.</p>
        </div>
        <div className="flex bg-[#141414] rounded-md border border-[#2a2a2a] p-1">
          {STAGE_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setStage(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                stage === tab.id ? "bg-[#1a1a1a] text-[#ffffff]" : "text-[#9a9a9a] hover:bg-[#141414]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse bg-[#141414] rounded-md border border-[#2a2a2a] p-8 space-y-4">
          <div className="h-4 bg-[#1a1a1a] rounded w-1/4" />
          <div className="h-10 bg-[#1a1a1a] rounded" />
          <div className="h-10 bg-[#1a1a1a] rounded" />
          <div className="h-10 bg-[#1a1a1a] rounded" />
        </div>
      ) : (
        <LeadTable leads={leads ?? []} />
      )}
    </div>
  );
}
