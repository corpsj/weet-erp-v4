"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { ModuleShell } from "@/components/layout/module-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LeadTable } from "@/components/modules/marketing/lead-table";
import { useMarketingLeads } from "@/lib/api/hooks/marketing";
import { formatDate } from "@/lib/utils/format";
import { JOURNEY_STAGE_LABELS, type MarketingLead } from "@/types/marketing";

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
      title="잠재고객 관리"
      description="플랫폼에서 수집된 잠재고객 목록입니다."
      breadcrumb={[{ label: "마케팅", href: "/marketing" }, { label: "잠재고객" }]}
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
  const [selectedLead, setSelectedLead] = useState<MarketingLead | null>(null);
  const { data: leads, isLoading, isError, refetch } = useMarketingLeads();

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

  function exportLeadsCsv() {
    const header = "사용자,플랫폼,점수,페르소나,여정단계,소스,수집일\n";
    const rows = filteredLeads
      .map((lead) =>
        [
          lead.username,
          lead.platform,
          lead.score,
          lead.personaType ?? "",
          JOURNEY_STAGE_LABELS[lead.journeyStage] ?? lead.journeyStage,
          lead.source ?? "",
          lead.createdAt,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="잠재고객 검색..."
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={exportLeadsCsv}>
            <Download className="mr-1 h-4 w-4" /> CSV
          </Button>
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

      <p className="text-sm text-[#9a9a9a]">{filteredLeads.length}명의 잠재고객</p>

      {isLoading ? (
        <div className="animate-pulse space-y-4 rounded-md border border-[#2a2a2a] bg-[#141414] p-8">
          <div className="h-4 w-1/4 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
          <div className="h-10 rounded bg-[#1a1a1a]" />
        </div>
      ) : isError ? (
        <Card className="mt-4 p-6">
          <p className="text-sm text-[var(--color-danger)]">잠재고객 데이터를 불러오지 못했습니다.</p>
          <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </Card>
      ) : (
        <LeadTable
          leads={filteredLeads}
          onRowClick={(lead) => {
            const fullLead = (leads ?? []).find((item) => item.id === lead.id);
            if (fullLead) setSelectedLead(fullLead);
          }}
        />
      )}

      <Modal open={selectedLead !== null} onClose={() => setSelectedLead(null)} title="잠재고객 상세">
        {selectedLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[#9a9a9a]">사용자</p>
                <p className="text-sm font-medium text-[#ffffff]">{selectedLead.username}</p>
              </div>
              <div>
                <p className="text-xs text-[#9a9a9a]">플랫폼</p>
                <p className="text-sm font-medium text-[#ffffff]">{selectedLead.platform}</p>
              </div>
              <div>
                <p className="text-xs text-[#9a9a9a]">점수</p>
                <p className="text-sm font-medium text-[#ffffff]">{selectedLead.score}점</p>
              </div>
              <div>
                <p className="text-xs text-[#9a9a9a]">여정 단계</p>
                <p className="text-sm font-medium text-[#ffffff]">
                  {JOURNEY_STAGE_LABELS[selectedLead.journeyStage] ?? selectedLead.journeyStage}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#9a9a9a]">페르소나</p>
                <p className="text-sm font-medium text-[#ffffff]">
                  {selectedLead.personaType ?? "미분류"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#9a9a9a]">소스</p>
                <p className="text-sm font-medium text-[#ffffff]">
                  {selectedLead.source ?? "알 수 없음"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-[#9a9a9a]">수집일</p>
              <p className="text-sm text-[#ffffff]">{formatDate(selectedLead.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
