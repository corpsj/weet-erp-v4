"use client";

import { useMarketingLeads } from "@/lib/api/hooks";
import { LeadTable } from "@/components/modules/marketing/lead-table";

export default function LeadsPage() {
  const { data: leads, isLoading } = useMarketingLeads();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#ffffff] tracking-tight">수집된 리드</h1>
          <p className="text-[#9a9a9a] mt-1">플랫폼에서 수집된 잠재 고객 목록입니다.</p>
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
