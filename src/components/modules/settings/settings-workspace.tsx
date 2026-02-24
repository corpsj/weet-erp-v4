"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createInviteCode, revealInviteCode, saveAiModelSetting, toggleInviteCodeActive, updateMyProfile } from "@/lib/api/actions/settings";
import { useAiModelSetting, useInviteCodes, useMySettingsProfile, useSettingsUsers } from "@/lib/api/hooks/settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { AiModelOption } from "@/types/settings";

type SettingsTab = "profile" | "invite" | "users" | "ai";

const PROFILE_COLORS = [
  "#d4d4d4",
  "#b0b0b0",
  "#e5e5e5",
  "#ff4d6d",
  "#f97316",
  "#84cc16",
  "#14b8a6",
  "#0ea5e9",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#eab308",
  "#f43f5e",
];

const AI_MODEL_OPTIONS: AiModelOption[] = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "openai/gpt-4o-mini", label: "GPT-4o mini" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
];

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
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

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setJobTitle(profile.job_title ?? "");
    setBio(profile.bio ?? "");
    setProfileColor(profile.profile_color || PROFILE_COLORS[0]);
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

  const tabItems = useMemo(
    () => [
      { key: "profile" as const, label: "프로필" },
      { key: "invite" as const, label: "초대 코드" },
      { key: "users" as const, label: "사용자" },
      { key: "ai" as const, label: "AI 설정" },
    ],
    [],
  );

  const refreshSettingsQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["settings-my-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-invite-codes"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-users"] }),
      queryClient.invalidateQueries({ queryKey: ["settings-ai-model"] }),
    ]);
  };

  const handleSaveProfile = async () => {
    const result = await updateMyProfile({
      display_name: displayName,
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

  if (profileLoading || !profile) {
    return <Card className="mt-4 h-80 animate-pulse" />;
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="inline-flex rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(10_19_31/75%)] p-1">
          {tabItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                tab === item.key ? "bg-[rgb(35_63_94/85%)] text-[var(--color-brand)]" : "text-[var(--color-ink-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="이름" />
              <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="직함" />
            </div>
            <textarea
              className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="소개"
            />
            <div>
              <p className="mb-2 text-xs text-[var(--color-ink-muted)]">프로필 색상</p>
              <div className="flex flex-wrap gap-2">
                {PROFILE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${profileColor === color ? "border-white" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setProfileColor(color)}
                    aria-label={`색상 ${color}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleSaveProfile()}>
                <CheckCircle2 className="mr-1 h-4 w-4" /> 저장
              </Button>
            </div>
          </div>
        ) : null}

        {tab === "invite" ? (
          <div className="mt-4 space-y-4">
            {isAdmin ? (
              <>
                <div className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(11_19_31/70%)] p-3">
                  <p className="text-sm font-semibold">초대코드 생성</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    <Input
                      type="number"
                      min={1}
                      value={inviteMaxUses}
                      onChange={(event) => setInviteMaxUses(event.target.value)}
                      placeholder="최대 사용 횟수 (선택)"
                    />
                    <Input
                      type="datetime-local"
                      value={inviteExpiresAt}
                      onChange={(event) => setInviteExpiresAt(event.target.value)}
                    />
                    <Input value={inviteMemo} onChange={(event) => setInviteMemo(event.target.value)} placeholder="메모 (선택)" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Button variant="outline" onClick={() => void handleCreateInviteCode()}>
                      <RefreshCw className="mr-1 h-4 w-4" /> 코드 생성
                    </Button>
                    {newlyCreatedCode ? (
                      <p className="rounded-lg bg-[rgb(212_212_212/14%)] px-3 py-1 text-sm text-[var(--color-brand)]">
                        신규 코드: <span className="display-font">{newlyCreatedCode}</span>
                      </p>
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
                      {inviteCodes.map((invite) => (
                        <TR key={invite.id}>
                          <TD>
                            <code className="rounded-md bg-[rgb(14_14_14/80%)] px-2 py-1 text-xs">{revealedCodes[invite.id] ?? "••••••••"}</code>
                          </TD>
                          <TD>{invite.is_active ? "활성" : "비활성"}</TD>
                          <TD>
                            {invite.use_count}
                            {invite.max_uses ? ` / ${invite.max_uses}` : " / 제한 없음"}
                          </TD>
                          <TD>{formatDateTime(invite.expires_at)}</TD>
                          <TD>{formatDateTime(invite.last_used_at)}</TD>
                          <TD className="text-xs text-[var(--color-ink-muted)]">{invite.memo ?? "-"}</TD>
                          <TD className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" className="h-8 px-2" onClick={() => void handleRevealInviteCode(invite.id)}>
                                <Eye className="h-4 w-4" />
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
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="space-y-2 lg:hidden">
                  {inviteCodes.map((invite) => (
                    <div key={invite.id} className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] p-3">
                      <p className="text-sm">코드: {revealedCodes[invite.id] ?? "••••••••"}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">상태: {invite.is_active ? "활성" : "비활성"}</p>
                      <p className="text-xs text-[var(--color-ink-muted)]">
                        사용: {invite.use_count}
                        {invite.max_uses ? ` / ${invite.max_uses}` : " / 제한 없음"}
                      </p>
                      <p className="text-xs text-[var(--color-ink-muted)]">마지막 사용: {formatDateTime(invite.last_used_at)}</p>
                      <div className="mt-2 flex justify-end gap-1">
                        <Button variant="ghost" className="h-8 px-2" onClick={() => void handleRevealInviteCode(invite.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" className="h-8 px-2" onClick={() => void handleToggleInviteActive(invite.id, !invite.is_active)}>
                          {invite.is_active ? "비활성화" : "활성화"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">
                초대 코드 관리는 관리자만 접근할 수 있습니다.
              </p>
            )}
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="mt-4">
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
                {users.map((user) => (
                  <TR key={user.id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: user.profile_color }} />
                        {user.display_name}
                      </div>
                    </TD>
                    <TD>{user.email}</TD>
                    <TD>{user.role === "admin" ? "관리자" : "일반"}</TD>
                    <TD>{user.status}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        ) : null}

        {tab === "ai" ? (
          <div className="mt-4 max-w-xl space-y-3">
            <select
              className="h-11 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 text-sm"
              value={selectedAiModel}
              onChange={(event) => setSelectedAiModel(event.target.value)}
            >
              {AI_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--color-ink-muted)]">공과금 AI 분석 모델로 사용됩니다.</p>
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
