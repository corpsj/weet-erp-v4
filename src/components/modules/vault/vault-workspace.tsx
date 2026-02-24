"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Copy, Eye, EyeOff, Lock, Plus, Search, Shield, SquarePen, Trash2, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { createVaultEntry, deleteVaultEntry, revealVaultPassword, updateVaultEntry } from "@/lib/api/actions/vault";
import { useVaultEntries } from "@/lib/api/hooks/vault";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { VaultEntry } from "@/types/vault";

type EditorState = {
  id?: string;
  site_name: string;
  url: string;
  username: string;
  password: string;
  memo: string;
};

type SortMode = "site" | "updated";

export function VaultWorkspace() {
  const queryClient = useQueryClient();
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("site");
  const [editorOpen, setEditorOpen] = useState(false);
  const [showEditorPassword, setShowEditorPassword] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ site_name: "", url: "", username: "", password: "", memo: "" });
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealExpiresAt, setRevealExpiresAt] = useState<Record<string, number>>({});
  const [lastAccessedAt, setLastAccessedAt] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  const { data: entries, isLoading, isError, refetch } = useVaultEntries();

  useEffect(() => {
    void markMenuAsRead("vault");
    const timers = clearTimersRef.current;
    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (Object.keys(revealExpiresAt).length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [revealExpiresAt]);

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const baseEntries = entries ?? [];
    const searched = !keyword
      ? baseEntries
      : baseEntries.filter((entry) => {
          const haystack = [entry.site_name, entry.url, entry.username, entry.memo].join(" ").toLowerCase();
          return haystack.includes(keyword);
        });

    return [...searched].sort((left, right) => {
      if (sortMode === "updated") {
        return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
      }

      return left.site_name.localeCompare(right.site_name, "ko");
    });
  }, [entries, search, sortMode]);

  const stats = useMemo(() => {
    const source = entries ?? [];
    const withUrlCount = source.filter((entry) => Boolean(entry.url)).length;

    return {
      totalCount: source.length,
      withUrlCount,
      revealedCount: Object.keys(revealedPasswords).length,
    };
  }, [entries, revealedPasswords]);

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["vault-entries"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const openCreate = () => {
    setShowEditorPassword(false);
    setEditor({ site_name: "", url: "", username: "", password: "", memo: "" });
    setEditorOpen(true);
  };

  const openEdit = (entry: VaultEntry) => {
    setShowEditorPassword(false);
    setEditor({
      id: entry.id,
      site_name: entry.site_name,
      url: entry.url ?? "",
      username: entry.username,
      password: "",
      memo: entry.memo ?? "",
    });
    setEditorOpen(true);
  };

  const clearRevealTimer = (entryId: string) => {
    const previousTimer = clearTimersRef.current.get(entryId);
    if (previousTimer) {
      clearTimeout(previousTimer);
      clearTimersRef.current.delete(entryId);
    }
  };

  const hideRevealedPassword = (entryId: string) => {
    clearRevealTimer(entryId);
    setRevealedPasswords((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
    setRevealExpiresAt((prev) => {
      const next = { ...prev };
      delete next[entryId];
      return next;
    });
  };

  const stampLastAccess = (entryId: string) => {
    setLastAccessedAt((prev) => ({
      ...prev,
      [entryId]: Date.now(),
    }));
  };

  const createRevealTimeout = (entryId: string) => {
    clearRevealTimer(entryId);
    const expiresAt = Date.now() + 15000;
    setRevealExpiresAt((prev) => ({ ...prev, [entryId]: expiresAt }));

    const timer = setTimeout(() => {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      setRevealExpiresAt((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      clearTimersRef.current.delete(entryId);
    }, 15000);

    clearTimersRef.current.set(entryId, timer);
  };

  const handleReveal = async (entryId: string, toastMessage = "비밀번호를 15초간 표시합니다.") => {
    const result = await revealVaultPassword(entryId);
    if (!result.ok) {
      toast.error(result.message);
      return null;
    }

    setRevealedPasswords((prev) => ({
      ...prev,
      [entryId]: result.data.password,
    }));

    stampLastAccess(entryId);
    createRevealTimeout(entryId);

    toast.success(toastMessage);
    return result.data.password;
  };

  const handleToggleReveal = async (entryId: string) => {
    if (revealedPasswords[entryId]) {
      hideRevealedPassword(entryId);
      toast.success("비밀번호 표시를 종료했습니다.");
      return;
    }

    await handleReveal(entryId);
  };

  const handleCopy = async (entryId: string) => {
    const password = revealedPasswords[entryId] ?? (await handleReveal(entryId, "비밀번호를 불러왔습니다."));
    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      stampLastAccess(entryId);
      toast.success("비밀번호를 클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  const handleCopyUsername = async (entry: VaultEntry) => {
    try {
      await navigator.clipboard.writeText(entry.username);
      stampLastAccess(entry.id);
      toast.success("아이디를 클립보드에 복사했습니다.");
    } catch {
      toast.error("아이디 복사에 실패했습니다.");
    }
  };

  const handleSave = async () => {
    if (!editor.id && !editor.password) {
      toast.error("새 계정 등록 시 비밀번호는 필수입니다.");
      return;
    }

    const payload = {
      site_name: editor.site_name,
      url: editor.url,
      username: editor.username,
      password: editor.password || undefined,
      memo: editor.memo,
    };

    if (editor.id) {
      const result = await updateVaultEntry(editor.id, payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("계정 정보를 수정했습니다.");
    } else {
      const result = await createVaultEntry(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("계정을 등록했습니다.");
    }

    setEditorOpen(false);
    await refreshQueries();
  };

  const handleDelete = async (entryId: string) => {
    const result = await deleteVaultEntry(entryId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    hideRevealedPassword(entryId);

    toast.success("계정을 삭제했습니다.");
    await refreshQueries();
  };

  const formatTimestamp = (value: string | number) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("ko-KR", { hour12: false });
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
        <p className="text-sm text-[var(--color-danger)]">Vault 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="border border-[#2a2a2a] bg-[#141414] p-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[#ffffff]">Vault Secret Workspace</p>
              <p className="text-xs text-[#9a9a9a]">AES 암호화 저장, 15초 자동 마스킹, 접근 기록 추적</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> 계정 등록
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
              <p className="text-[11px] text-[#9a9a9a]">총 계정</p>
              <p className="text-base font-semibold text-[#ffffff]">{stats.totalCount}</p>
            </div>
            <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
              <p className="text-[11px] text-[#9a9a9a]">URL 등록</p>
              <p className="text-base font-semibold text-[#ffffff]">{stats.withUrlCount}</p>
            </div>
            <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
              <p className="text-[11px] text-[#9a9a9a]">현재 표시 중</p>
              <p className="text-base font-semibold text-[#ffffff]">{stats.revealedCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="사이트, URL, 아이디, 메모 검색"
              />
            </div>
            <select
              className="h-10 rounded-md border border-[#3a3a3a] bg-[#141414] px-3 text-sm text-[#e5e5e5] outline-none focus:border-[#e5e5e5]"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="site">사이트명순</option>
              <option value="updated">최근 수정순</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredEntries.map((entry) => {
            const revealed = revealedPasswords[entry.id];
            const expiresAt = revealExpiresAt[entry.id];
            const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - nowTick) / 1000)) : 0;
            const isRevealed = Boolean(revealed);
            const lastAccess = lastAccessedAt[entry.id];

            return (
              <article key={entry.id} className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#ffffff]">{entry.site_name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#b0b0b0]">{entry.username}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone="neutral" className="h-5 px-2 text-[10px]">
                      <Lock className="mr-1 h-3 w-3" />
                      {isRevealed ? "표시중" : "마스킹"}
                    </Badge>
                    {isRevealed ? (
                      <Badge tone="warning" className="h-5 px-2 text-[10px]">
                        {secondsLeft}s
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs text-[#9a9a9a]">
                  <p className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    저장 시 암호화, 노출 후 15초 뒤 자동 마스킹
                  </p>
                  <p>수정 시각: {formatTimestamp(entry.updated_at)}</p>
                  <p>최근 접근: {lastAccess ? formatTimestamp(lastAccess) : "-"}</p>
                </div>

                {entry.url ? (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs text-[#d4d4d4] underline-offset-2 hover:underline">
                    {entry.url}
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-[#9a9a9a]">URL 없음</p>
                )}

                <div className="mt-3 rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#9a9a9a]">비밀번호</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void handleToggleReveal(entry.id)}>
                      {isRevealed ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                      {isRevealed ? "숨기기" : "표시"}
                    </Button>
                  </div>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.code
                      key={isRevealed ? "revealed" : "masked"}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16 }}
                      className="mt-1 block truncate rounded-sm bg-[#0a0a0a] px-2 py-1.5 text-xs text-[#e5e5e5]"
                    >
                      {isRevealed ? revealed : "••••••••"}
                    </motion.code>
                  </AnimatePresence>
                </div>

                {entry.memo ? <p className="mt-2 max-h-10 overflow-hidden text-xs text-[#b0b0b0]">{entry.memo}</p> : null}

                <div className="mt-3 flex flex-wrap justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void handleCopy(entry.id)}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> 비밀번호 복사
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void handleCopyUsername(entry)}>
                    <UserRound className="mr-1 h-3.5 w-3.5" /> 아이디 복사
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openEdit(entry)}>
                    <SquarePen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void handleDelete(entry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {filteredEntries.length === 0 ? (
          <p className="mt-4 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">검색 결과가 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "계정 수정" : "계정 등록"}>
        <div className="space-y-3">
          <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2">
            <p className="text-xs text-[#9a9a9a]">입력 비밀번호는 저장 시 암호화되며 평문으로 DB에 남지 않습니다.</p>
          </div>
          <label className="space-y-1 text-xs text-[#b0b0b0]">
            <span>사이트명</span>
            <Input
              value={editor.site_name}
              onChange={(event) => setEditor((prev) => ({ ...prev, site_name: event.target.value }))}
              placeholder="사이트명"
            />
          </label>
          <label className="space-y-1 text-xs text-[#b0b0b0]">
            <span>URL</span>
            <Input value={editor.url} onChange={(event) => setEditor((prev) => ({ ...prev, url: event.target.value }))} placeholder="URL (https://...)" />
          </label>
          <label className="space-y-1 text-xs text-[#b0b0b0]">
            <span>아이디</span>
            <Input
              value={editor.username}
              onChange={(event) => setEditor((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="아이디"
            />
          </label>
          <label className="space-y-1 text-xs text-[#b0b0b0]">
            <span>{editor.id ? "새 비밀번호 (입력 시 갱신)" : "비밀번호"}</span>
            <div className="relative">
              <Input
                type={showEditorPassword ? "text" : "password"}
                value={editor.password}
                onChange={(event) => setEditor((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={editor.id ? "새 비밀번호 입력 시 변경" : "비밀번호"}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-[#9a9a9a]"
                onClick={() => setShowEditorPassword((prev) => !prev)}
              >
                {showEditorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          <label className="space-y-1 text-xs text-[#b0b0b0]">
            <span>메모</span>
            <textarea
              className="min-h-24 w-full rounded-md border border-[#3a3a3a] bg-[#141414] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#e5e5e5]"
              value={editor.memo}
              onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
              placeholder="메모"
            />
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
