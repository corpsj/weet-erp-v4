"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, Eye, EyeOff, Plus, SquarePen, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { createVaultEntry, deleteVaultEntry, revealVaultPassword, updateVaultEntry } from "@/lib/api/actions/vault";
import { useVaultEntries } from "@/lib/api/hooks/vault";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { VaultEntry } from "@/types/vault";

type EditorState = {
  id?: string;
  site_name: string;
  url: string;
  username: string;
  password: string;
  memo: string;
};

export function VaultWorkspace() {
  const queryClient = useQueryClient();
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [showEditorPassword, setShowEditorPassword] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ site_name: "", url: "", username: "", password: "", memo: "" });
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

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

  const filteredEntries = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return entries ?? [];
    }

    return (entries ?? []).filter((entry) => {
      const haystack = [entry.site_name, entry.url, entry.username, entry.memo].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [entries, search]);

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

    const previousTimer = clearTimersRef.current.get(entryId);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const timer = setTimeout(() => {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
      clearTimersRef.current.delete(entryId);
    }, 15000);
    clearTimersRef.current.set(entryId, timer);

    toast.success(toastMessage);
    return result.data.password;
  };

  const handleCopy = async (entryId: string) => {
    const password = revealedPasswords[entryId] ?? (await handleReveal(entryId, "비밀번호를 불러왔습니다."));
    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      toast.success("비밀번호를 클립보드에 복사했습니다.");
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
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

    toast.success("계정을 삭제했습니다.");
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
        <p className="text-sm text-[var(--color-danger)]">Vault 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="w-full max-w-md">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="사이트, URL, 아이디, 메모 검색" />
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> 계정 등록
          </Button>
        </div>

        <div className="mt-4 hidden lg:block">
          <Table>
            <THead>
              <TR>
                <TH>사이트</TH>
                <TH>URL</TH>
                <TH>아이디</TH>
                <TH>비밀번호</TH>
                <TH>메모</TH>
                <TH className="w-[150px] text-right">작업</TH>
              </TR>
            </THead>
            <TBody>
              {filteredEntries.map((entry) => {
                const revealed = revealedPasswords[entry.id];
                return (
                  <TR key={entry.id}>
                    <TD>{entry.site_name}</TD>
                    <TD>
                      {entry.url ? (
                        <a href={entry.url} target="_blank" rel="noreferrer" className="text-[var(--color-brand)] hover:underline">
                          {entry.url}
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-muted)]">없음</span>
                      )}
                    </TD>
                    <TD>{entry.username}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <code className="rounded-md bg-[rgb(14_14_14/80%)] px-2 py-1 text-xs">{revealed ?? "••••••••"}</code>
                        <Button variant="ghost" className="h-8 px-2" onClick={() => void handleReveal(entry.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" className="h-8 px-2" onClick={() => void handleCopy(entry.id)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                    <TD className="max-w-[280px] truncate text-xs text-[var(--color-ink-muted)]">{entry.memo ?? "-"}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(entry)}>
                          <SquarePen className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(entry.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        <div className="mt-4 space-y-2 lg:hidden">
          {filteredEntries.map((entry) => {
            const revealed = revealedPasswords[entry.id];
            return (
              <div key={entry.id} className="rounded-xl border border-[rgb(42_42_42/45%)] bg-[rgb(16_27_43/65%)] p-3">
                <p className="text-sm font-medium">{entry.site_name}</p>
                <p className="text-xs text-[var(--color-ink-muted)]">{entry.username}</p>
                {entry.url ? (
                  <a href={entry.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-[var(--color-brand)] hover:underline">
                    {entry.url}
                  </a>
                ) : null}
                <div className="mt-2 flex items-center gap-1">
                  <code className="rounded-md bg-[rgb(14_14_14/80%)] px-2 py-1 text-xs">{revealed ?? "••••••••"}</code>
                  <Button variant="ghost" className="h-8 px-2" onClick={() => void handleReveal(entry.id)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2" onClick={() => void handleCopy(entry.id)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {entry.memo ? <p className="mt-2 text-xs text-[var(--color-ink-muted)]">{entry.memo}</p> : null}
                <div className="mt-2 flex justify-end gap-1">
                  <Button variant="ghost" className="h-8 px-2" onClick={() => openEdit(entry)}>
                    <SquarePen className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-2" onClick={() => void handleDelete(entry.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredEntries.length === 0 ? (
          <p className="mt-4 rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">등록된 계정이 없습니다.</p>
        ) : null}
      </Card>

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editor.id ? "계정 수정" : "계정 등록"}>
        <div className="space-y-3">
          <Input
            value={editor.site_name}
            onChange={(event) => setEditor((prev) => ({ ...prev, site_name: event.target.value }))}
            placeholder="사이트명"
          />
          <Input value={editor.url} onChange={(event) => setEditor((prev) => ({ ...prev, url: event.target.value }))} placeholder="URL (https://...)" />
          <Input
            value={editor.username}
            onChange={(event) => setEditor((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="아이디"
          />
          <div className="relative">
            <Input
              type={showEditorPassword ? "text" : "password"}
              value={editor.password}
              onChange={(event) => setEditor((prev) => ({ ...prev, password: event.target.value }))}
              placeholder={editor.id ? "새 비밀번호 입력 시 변경" : "비밀번호"}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-[var(--color-ink-muted)]"
              onClick={() => setShowEditorPassword((prev) => !prev)}
            >
              {showEditorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <textarea
            className="min-h-24 w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)]"
            value={editor.memo}
            onChange={(event) => setEditor((prev) => ({ ...prev, memo: event.target.value }))}
            placeholder="메모"
          />
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
