"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { Input } from "@/components/ui/input";
import { LeadTable } from "@/components/modules/marketing/lead-table";
import { useMarketingLeads } from "@/lib/api/hooks/marketing";
import { JOURNEY_STAGE_LABELS } from "@/types/marketing";

const STAGE_TABS = [
  { id: undefined, label: "전체" },
  ...Object.entries(JOURNEY_STAGE_LABELS).map(([id, label]) => ({ id, label })),
] as const;

const SORT_OPTIONS = [
  { id: "score_desc", label: "스코어 높은순" },
  { id: "latest", label: "최신순" },
  { id: "score_asc", label: "스코어 낮은순" },
] as const;

export default function LeadsPage() {
  return (
    <ModuleShell
      title="수집된 리드"
      description="플랫폼에서 수집된 잠재 고객 목록입니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "리드" }]}
    >
      <LeadsContent />
    </ModuleShell>
  );
}

function LeadsContent() {
  const [stage, setStage] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]["id"]>("score_desc");
  const { data: leads, isLoading } = useMarketingLeads();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  const filteredLeads = useMemo(() => {
    const keyword = debouncedSearch.toLowerCase();
    const list = (leads ?? []).filter((lead) => {
      const inStage = !stage || lead.journeyStage === stage;
      const matchesSearch =
        keyword.length === 0 ||
        lead.username.toLowerCase().includes(keyword) ||
        lead.platform.toLowerCase().includes(keyword);
      return inStage && matchesSearch;
    });

    return list.sort((a, b) => {
      if (sortBy === "score_desc") return b.score - a.score;
      if (sortBy === "score_asc") return a.score - b.score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [debouncedSearch, leads, sortBy, stage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="리드 검색..."
            className="pl-9"
          />
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          <div className="flex overflow-x-auto rounded-md border border-[#2a2a2a] bg-[#141414] p-1">
            {STAGE_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                onClick={() => setStage(tab.id)}
                className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  stage === tab.id
                    ? "bg-[#1a1a1a] text-[#ffffff]"
                    : "text-[#9a9a9a] hover:bg-[#141414]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]["id"])
            }
            className="h-10 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 text-sm text-[#ffffff] outline-none focus:border-[#3a3a3a]"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-sm text-[#9a9a9a]">{filteredLeads.length}개의 리드</p>

      {isLoading ? (
        <div className="animate-pulse space-y-4 rounded-md border border-[#2a2a2a] bg-[#141414] p-8">
          <div className="h-4 w-1/4 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
        </div>
      ) : (
        <LeadTable leads={filteredLeads} />
      )}
    </div>
  );
}
