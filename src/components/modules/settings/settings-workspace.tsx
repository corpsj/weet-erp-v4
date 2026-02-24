"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, RefreshCw, Search, Shield, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInviteCode, revealInviteCode, saveAiModelSetting, toggleInviteCodeActive, updateMyProfile } from "@/lib/api/actions/settings";
import { useAiModelSetting, useInviteCodes, useMySettingsProfile, useSettingsUsers } from "@/lib/api/hooks/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { AiModelOption } from "@/types/settings";

type SettingsTab = "profile" | "invite" | "users" | "ai";

const PROFILE_COLORS = ["#1a1a1a", "#2a2a2a", "#3a3a3a", "#9a9a9a", "#b0b0b0", "#d4d4d4", "#e5e5e5", "#ff4d6d"];

const AI_MODEL_OPTIONS: AiModelOption[] = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
];

const AI_MODEL_DESCRIPTIONS: Record<string, string> = {
  "google/gemini-2.5-flash": "가장 빠른 기본 모델, 분석 응답 속도 최우선",
  "google/gemini-2.0-flash-001": "안정적인 경량 모델, 비용 절감형 운영",
  "openai/gpt-4o-mini": "텍스트 품질 중심, 일반 문서 분류 정확도 우수",
  "openai/gpt-4.1-mini": "복합 질의 추론에 강한 균형형 모델",
  "anthropic/claude-3.5-haiku": "요약/정리형 작업에서 일관된 답변 품질",
};

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}

function normalizeProfileColor(color: string | null | undefined) {
  const normalized = color?.toLowerCase() ?? "";
  const matched = PROFILE_COLORS.find((item) => item.toLowerCase() === normalized);
  return matched ?? PROFILE_COLORS[0];
}

function resolveInviteStatus(expiresAt: string | null, useCount: number, maxUses: number | null) {
  if (maxUses && useCount >= maxUses) {
    return { label: "사용 완료", className: "border-[#3a3a3a] bg-[#1a1a1a] text-[#b0b0b0]" };
  }
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return { label: "만료", className: "border-[#ff4d6d] bg-[#1a1a1a] text-[#ff4d6d]" };
  }
  return { label: "사용 가능", className: "border-[#3a3a3a] bg-[#141414] text-[#d4d4d4]" };
}

export function SettingsWorkspace() {
  const queryClient = useQueryClient();
  const hideCodeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [revealedCodes, setRevealedCodes] = useState<Record<string, string>>({});
  const [newlyCreatedCode, setNewlyCreatedCode] = useState<string | null>(null);

  const { data: profile, isLoading: profileLoading } = useMySettingsProfile();
  const { data: inviteCodes = [] } = useInviteCodes();
  const { data: users = [] } = useSettingsUsers();
  const { data: aiModel } = useAiModelSetting();

  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");
  const [profileColor, setProfileColor] = useState(PROFILE_COLORS[0]);
  const [inviteMaxUses, setInviteMaxUses] = useState("");
  const [inviteExpiresAt, setInviteExpiresAt] = useState("");
  const [inviteMemo, setInviteMemo] = useState("");
  const [selectedAiModel, setSelectedAiModel] = useState(AI_MODEL_OPTIONS[0].value);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setJobTitle(profile.job_title ?? "");
    setBio(profile.bio ?? "");
    setProfileColor(normalizeProfileColor(profile.profile_color));
  }, [profile]);

  useEffect(() => {
    if (!aiModel) return;
    setSelectedAiModel(aiModel);
  }, [aiModel]);

  useEffect(() => {
    const timers = hideCodeTimersRef.current;
    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, []);

  const isAdmin = profile?.role === "admin";

  const profileDirty = useMemo(() => {
    if (!profile) return false;
    return (
      displayName !== (profile.display_name ?? "") ||
      jobTitle !== (profile.job_title ?? "") ||
      bio !== (profile.bio ?? "") ||
      profileColor !== normalizeProfileColor(profile.profile_color)
    );
  }, [bio, displayName, jobTitle, profile, profileColor]);

  const tabItems = useMemo(
    () => [
      { key: "profile" as const, label: "프로필", icon: UserRound },
      { key: "invite" as const, label: "초대 코드", icon: Shield },
      { key: "users" as const, label: "사용자", icon: UserRound },
      { key: "ai" as const, label: "AI 설정", icon: CheckCircle2 },
    ],
    [],
  );

  const usersFiltered = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const haystack = `${user.display_name} ${user.email} ${user.username}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [userSearch, users]);

  const usersSummary = useMemo(() => {
    const active = usersFiltered.filter((user) => user.status === "active").length;
    const admins = usersFiltered.filter((user) => user.role === "admin").length;
    return { total: usersFiltered.length, active, admins };
  }, [usersFiltered]);

  const refreshSettingsQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["settings-my-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-invite-codes"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-users"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-ai-model"] }),
    ]);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    const result = await updateMyProfile({
      display_name: displayName.trim(),
      job_title: jobTitle,
      bio,
      profile_color: profileColor,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("프로필을 저장했습니다.");
    await refreshSettingsQueries();
  };

  const resetProfileEditor = () => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setJobTitle(profile.job_title ?? "");
    setBio(profile.bio ?? "");
    setProfileColor(normalizeProfileColor(profile.profile_color));
  };

  const handleCreateInviteCode = async () => {
    if (!isAdmin) {
      toast.error("관리자만 초대코드를 생성할 수 있습니다.");
      return;
    }

    const maxUses = inviteMaxUses.trim() ? Number(inviteMaxUses) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      toast.error("최대 사용 횟수는 1 이상의 정수여야 합니다.");
      return;
    }

    const expiresAt = inviteExpiresAt.trim() ? new Date(inviteExpiresAt).toISOString() : null;
    const result = await createInviteCode({
      max_uses: maxUses,
      expires_at: expiresAt,
      memo: inviteMemo,
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setNewlyCreatedCode(result.data.code);
    setInviteMaxUses("");
    setInviteExpiresAt("");
    setInviteMemo("");
    toast.success("초대코드를 생성했습니다.");
    await refreshSettingsQueries();
  };

  const handleToggleInviteActive = async (inviteCodeId: string, nextActive: boolean) => {
    const result = await toggleInviteCodeActive(inviteCodeId, nextActive);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(nextActive ? "초대코드를 활성화했습니다." : "초대코드를 비활성화했습니다.");
    await refreshSettingsQueries();
  };

  const handleRevealInviteCode = async (inviteCodeId: string) => {
    const result = await revealInviteCode(inviteCodeId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setRevealedCodes((prev) => ({ ...prev, [inviteCodeId]: result.data.code }));
    const prevTimer = hideCodeTimersRef.current.get(inviteCodeId);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }
    const timer = setTimeout(() => {
      setRevealedCodes((prev) => {
        const next = { ...prev };
        delete next[inviteCodeId];
        return next;
      });
      hideCodeTimersRef.current.delete(inviteCodeId);
    }, 15000);
    hideCodeTimersRef.current.set(inviteCodeId, timer);

    toast.success("초대코드를 15초간 표시합니다.");
  };

  const handleSaveAiModel = async () => {
    const result = await saveAiModelSetting({ model: selectedAiModel });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("AI 모델 설정을 저장했습니다.");
    await refreshSettingsQueries();
  };

  const copyText = async (value: string, successMessage: string) => {
    const safeValue = value.trim();
    if (!safeValue) return;
    const copied = await navigator.clipboard.writeText(safeValue).then(() => true).catch(() => false);
    if (!copied) {
      toast.error("클립보드 복사에 실패했습니다.");
      return;
    }
    toast.success(successMessage);
  };

  if (profileLoading || !profile) {
    return <Card className="mt-4 h-80 animate-pulse border-[#2a2a2a] bg-[#141414]" />;
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="border-[#2a2a2a] bg-[#141414] p-4">
        <div className="flex flex-wrap gap-2 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-1">
          {tabItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                tab === item.key ? "bg-[#1a1a1a] text-[#ffffff]" : "text-[#9a9a9a] hover:text-[#d4d4d4]"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="이름" />
                  <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="직함" />
                </div>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none transition focus:border-[#d4d4d4]"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="소개"
                />
                <div>
                  <p className="mb-2 text-xs text-[#9a9a9a]">프로필 색상 (Grok 팔레트)</p>
                  <div className="flex flex-wrap gap-2">
                    {PROFILE_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full border-2 transition ${profileColor === color ? "border-[#ffffff]" : "border-[#3a3a3a]"}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setProfileColor(color)}
                        aria-label={`색상 ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4">
                <p className="text-xs text-[#9a9a9a]">미리보기</p>
                <div className="flex items-center gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-[#ffffff]" style={{ backgroundColor: profileColor }}>
                    {(displayName.trim() || profile.display_name || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#e5e5e5]">{displayName || "이름"}</p>
                    <p className="text-xs text-[#9a9a9a]">{jobTitle || "직함"}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 text-xs text-[#b0b0b0]">
                  {bio.trim() || "자기소개를 입력하면 여기에 표시됩니다."}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={!profileDirty} onClick={resetProfileEditor}>
                초기화
              </Button>
              <Button disabled={!profileDirty} onClick={() => void handleSaveProfile()}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> 저장
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "invite" ? (
          <div className="mt-4 space-y-4">
            {isAdmin ? (
              <>
                <div className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-4">
                  <p className="text-sm font-semibold text-[#e5e5e5]">초대코드 생성</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <Input
                      type="number"
                      min={1}
                      value={inviteMaxUses}
                      onChange={(event) => setInviteMaxUses(event.target.value)}
                      placeholder="최대 사용 횟수 (선택)"
                    />
                    <Input type="datetime-local" value={inviteExpiresAt} onChange={(event) => setInviteExpiresAt(event.target.value)} />
                    <Input value={inviteMemo} onChange={(event) => setInviteMemo(event.target.value)} placeholder="메모 (선택)" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button variant="outline" onClick={() => void handleCreateInviteCode()}>
                      <RefreshCw className="mr-1 h-4 w-4" /> 코드 생성
                    </Button>
                    {newlyCreatedCode ? (
                      <div className="inline-flex items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#141414] px-3 py-1 text-sm text-[#e5e5e5]">
                        신규 코드: <span className="display-font">{newlyCreatedCode}</span>
                        <button
                          type="button"
                          className="rounded-md border border-[#3a3a3a] p-1 text-[#b0b0b0] transition hover:text-[#ffffff]"
                          onClick={() => void copyText(newlyCreatedCode, "신규 코드를 복사했습니다.")}
                          aria-label="신규 코드 복사"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="hidden lg:block">
                  <Table>
                    <THead>
                      <TR>
                        <TH>코드</TH>
                        <TH>상태</TH>
                        <TH>사용</TH>
                        <TH>만료일</TH>
                        <TH>마지막 사용</TH>
                        <TH>메모</TH>
                        <TH className="text-right">작업</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {inviteCodes.map((invite) => {
                        const inviteStatus = resolveInviteStatus(invite.expires_at, invite.use_count, invite.max_uses);
                        return (
                          <TR key={invite.id}>
                            <TD>
                              <code className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 text-xs text-[#e5e5e5]">
                                {revealedCodes[invite.id] ?? "••••••••"}
                              </code>
                            </TD>
                            <TD>
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge className={invite.is_active ? "border-[#3a3a3a] bg-[#1a1a1a] text-[#d4d4d4]" : "border-[#3a3a3a] bg-[#0a0a0a] text-[#9a9a9a]"}>
                                  {invite.is_active ? "활성" : "비활성"}
                                </Badge>
                                <Badge className={inviteStatus.className}>{inviteStatus.label}</Badge>
                              </div>
                            </TD>
                            <TD>
                              {invite.use_count}
                              {invite.max_uses ? ` / ${invite.max_uses}` : " / 제한 없음"}
                            </TD>
                            <TD>{formatDateTime(invite.expires_at)}</TD>
                            <TD>{formatDateTime(invite.last_used_at)}</TD>
                            <TD className="text-xs text-[#9a9a9a]">{invite.memo ?? "-"}</TD>
                            <TD className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" className="h-8 px-2" onClick={() => void handleRevealInviteCode(invite.id)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-8 px-2"
                                  disabled={!revealedCodes[invite.id]}
                                  onClick={() => void copyText(revealedCodes[invite.id] ?? "", "초대코드를 복사했습니다.")}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  className="h-8 px-2"
                                  onClick={() => void handleToggleInviteActive(invite.id, !invite.is_active)}
                                >
                                  {invite.is_active ? "비활성화" : "활성화"}
                                </Button>
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                </div>

                <div className="space-y-2 lg:hidden">
                  {inviteCodes.map((invite) => {
                    const inviteStatus = resolveInviteStatus(invite.expires_at, invite.use_count, invite.max_uses);
                    return (
                      <div key={invite.id} className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                        <p className="text-sm text-[#e5e5e5]">코드: {revealedCodes[invite.id] ?? "••••••••"}</p>
                        <p className="text-xs text-[#9a9a9a]">상태: {invite.is_active ? "활성" : "비활성"}</p>
                        <p className="text-xs text-[#9a9a9a]">상세: {inviteStatus.label}</p>
                        <p className="text-xs text-[#9a9a9a]">
                          사용: {invite.use_count}
                          {invite.max_uses ? ` / ${invite.max_uses}` : " / 제한 없음"}
                        </p>
                        <p className="text-xs text-[#9a9a9a]">마지막 사용: {formatDateTime(invite.last_used_at)}</p>
                        <div className="mt-2 flex justify-end gap-1">
                          <Button variant="ghost" className="h-8 px-2" onClick={() => void handleRevealInviteCode(invite.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 px-2"
                            disabled={!revealedCodes[invite.id]}
                            onClick={() => void copyText(revealedCodes[invite.id] ?? "", "초대코드를 복사했습니다.")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" className="h-8 px-2" onClick={() => void handleToggleInviteActive(invite.id, !invite.is_active)}>
                            {invite.is_active ? "비활성화" : "활성화"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-4 text-sm text-[#9a9a9a]">
                초대 코드 관리는 관리자만 접근할 수 있습니다.
              </p>
            )}
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
                <Input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="이름/이메일/아이디 검색"
                  className="pl-9"
                />
              </div>
              <Badge className="justify-center border-[#3a3a3a] bg-[#0a0a0a] px-3 text-[#d4d4d4]">전체 {usersSummary.total}</Badge>
              <Badge className="justify-center border-[#3a3a3a] bg-[#0a0a0a] px-3 text-[#d4d4d4]">관리자 {usersSummary.admins}</Badge>
              <Badge className="justify-center border-[#3a3a3a] bg-[#0a0a0a] px-3 text-[#d4d4d4]">활성 {usersSummary.active}</Badge>
            </div>

            <Table>
              <THead>
                <TR>
                  <TH>이름</TH>
                  <TH>이메일</TH>
                  <TH>역할</TH>
                  <TH>상태</TH>
                </TR>
              </THead>
              <TBody>
                {usersFiltered.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: normalizeProfileColor(user.profile_color) }} />
                        {user.display_name}
                      </div>
                    </TD>
                    <TD>{user.email}</TD>
                    <TD>
                      <Badge className={user.role === "admin" ? "border-[#3a3a3a] bg-[#1a1a1a] text-[#e5e5e5]" : "border-[#3a3a3a] bg-[#0a0a0a] text-[#b0b0b0]"}>
                        {user.role === "admin" ? "관리자" : "일반"}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge
                        className={
                          user.status === "active"
                            ? "border-[#3a3a3a] bg-[#141414] text-[#e5e5e5]"
                            : user.status === "pending"
                              ? "border-[#ff4d6d] bg-[#141414] text-[#ff4d6d]"
                              : "border-[#2a2a2a] bg-[#0a0a0a] text-[#9a9a9a]"
                        }
                      >
                        {user.status === "active" ? "활성" : user.status === "pending" ? "대기" : "비활성"}
                      </Badge>
                    </TD>
                  </TR>
                ))}
                {usersFiltered.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="py-8 text-center text-sm text-[#9a9a9a]">
                      검색 조건에 맞는 사용자가 없습니다.
                    </TD>
                  </TR>
                ) : null}
              </TBody>
            </Table>
          </div>
        ) : null}

        {tab === "ai" ? (
          <div className="mt-4 max-w-3xl space-y-3">
            <select
              className="h-11 w-full rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] px-3 text-sm text-[#e5e5e5]"
              value={selectedAiModel}
              onChange={(event) => setSelectedAiModel(event.target.value)}
            >
              {AI_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="grid gap-2 md:grid-cols-2">
              {AI_MODEL_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`rounded-xl border p-3 ${
                    option.value === selectedAiModel ? "border-[#d4d4d4] bg-[#1a1a1a]" : "border-[#2a2a2a] bg-[#0a0a0a]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#e5e5e5]">{option.label}</p>
                    {option.value === selectedAiModel ? (
                      <Badge className="border-[#3a3a3a] bg-[#141414] text-[#d4d4d4]">현재 선택</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#9a9a9a]">{AI_MODEL_DESCRIPTIONS[option.value] ?? ""}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-[#9a9a9a]">공과금 AI 분석 모델로 사용됩니다.</p>
            <div className="flex justify-end">
              <Button onClick={() => void handleSaveAiModel()}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> 저장
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
