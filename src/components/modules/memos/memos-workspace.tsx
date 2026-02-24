"use client";

import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Download,
  FileUp,
  Folder,
  FolderPlus,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createMemo,
  createMemoFolder,
  deleteMemoAttachment,
  deleteMemoFolder,
  getMemoAttachmentDownloadUrl,
  permanentlyDeleteMemo,
  renameMemoFolder,
  restoreMemo,
  trashMemo,
  updateMemo,
  uploadMemoAttachment,
} from "@/lib/api/actions/memos";
import { markMenuAsRead } from "@/lib/api/actions/hub";
import { useMemoAttachments, useMemoFolders, useMemos } from "@/lib/api/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FolderFilter = "all" | "trash" | string;

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const normalizedQuery = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const parts: Array<{ key: string; value: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const found = lowerText.indexOf(lowerQuery, cursor);
    if (found === -1) {
      parts.push({
        key: `plain-${cursor}`,
        value: text.slice(cursor),
        match: false,
      });
      break;
    }

    if (found > cursor) {
      parts.push({
        key: `plain-${cursor}`,
        value: text.slice(cursor, found),
        match: false,
      });
    }

    const end = found + normalizedQuery.length;
    parts.push({
      key: `match-${found}`,
      value: text.slice(found, end),
      match: true,
    });
    cursor = end;
  }

  return parts.map((part) =>
    part.match ? (
      <mark key={part.key} className="rounded bg-[rgb(229_229_229/30%)] px-0.5 text-[var(--color-warning)]">
        {part.value}
      </mark>
    ) : (
      <span key={part.key}>{part.value}</span>
    ),
  );
}

function getTimeGroup(value: string) {
  const date = parseISO(value);
  const diff = differenceInCalendarDays(startOfToday(), date);

  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff <= 7) return "지난 7일";
  if (format(date, "yyyy-MM") === format(new Date(), "yyyy-MM")) return "이번 달";
  return "이전";
}

export function MemosWorkspace() {
  const queryClient = useQueryClient();
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: folders, isLoading: folderLoading } = useMemoFolders();
  const { data: memos, isLoading: memoLoading, isError, refetch } = useMemos();
  const { data: attachments } = useMemoAttachments(selectedMemoId ?? undefined);

  useEffect(() => {
    void markMenuAsRead("memos");
  }, []);

  const filteredMemos = useMemo(() => {
    const all = memos ?? [];
    return all.filter((memo) => {
      if (folderFilter === "trash") {
        if (!memo.deletedAt) return false;
      } else {
        if (memo.deletedAt) return false;
        if (folderFilter !== "all" && memo.folderId !== folderFilter) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const title = (memo.title ?? "").toLowerCase();
        const content = memo.content.toLowerCase();
        if (!title.includes(q) && !content.includes(q)) return false;
      }

      return true;
    });
  }, [folderFilter, memos, search]);

  const groupedMemos = useMemo(() => {
    const map = new Map<string, typeof filteredMemos>();
    filteredMemos.forEach((memo) => {
      const key = getTimeGroup(memo.updatedAt);
      const list = map.get(key) ?? [];
      list.push(memo);
      map.set(key, list);
    });
    return map;
  }, [filteredMemos]);

  const selectedMemo = useMemo(
    () => filteredMemos.find((memo) => memo.id === selectedMemoId) ?? null,
    [filteredMemos, selectedMemoId],
  );

  useEffect(() => {
    if (!filteredMemos.length) {
      setSelectedMemoId(null);
      return;
    }

    if (!selectedMemoId || !filteredMemos.some((memo) => memo.id === selectedMemoId)) {
      setSelectedMemoId(filteredMemos[0].id);
    }
  }, [filteredMemos, selectedMemoId]);

  useEffect(() => {
    if (!selectedMemo) {
      setEditorTitle("");
      setEditorContent("");
      return;
    }
    setEditorTitle(selectedMemo.title ?? "");
    setEditorContent(selectedMemo.content);
  }, [selectedMemo]);

  useEffect(() => {
    if (!selectedMemo || selectedMemo.deletedAt) return;
    if ((selectedMemo.title ?? "") === editorTitle && selectedMemo.content === editorContent) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      const result = await updateMemo(selectedMemo.id, {
        title: editorTitle || "제목 없음",
        content: editorContent,
      });
      setSaving(false);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["memos"] });
    }, 1000);

    return () => clearTimeout(timer);
  }, [editorContent, editorTitle, queryClient, selectedMemo]);

  const refreshMemos = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["memos"] }),
      queryClient.invalidateQueries({ queryKey: ["memo-folders"] }),
      queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
      queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
    ]);
  };

  const handleCreateMemo = async () => {
    const result = await createMemo(folderFilter !== "all" && folderFilter !== "trash" ? folderFilter : null);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("메모를 생성했습니다.");
    await refreshMemos();
    setSelectedMemoId(result.data.id);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("폴더 이름을 입력해주세요.");
      return;
    }

    const result = await createMemoFolder(newFolderName);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    setNewFolderName("");
    toast.success("폴더를 생성했습니다.");
    await refreshMemos();
  };

  const handleRenameFolder = async (folderId: string, currentName: string) => {
    const name = window.prompt("새 폴더 이름", currentName);
    if (!name || name === currentName) return;

    const result = await renameMemoFolder(folderId, name);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("폴더 이름을 변경했습니다.");
    await refreshMemos();
  };

  const handleDeleteFolder = async (folderId: string) => {
    const result = await deleteMemoFolder(folderId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("폴더를 삭제했습니다.");
    if (folderFilter === folderId) setFolderFilter("all");
    await refreshMemos();
  };

  const handleTogglePin = async () => {
    if (!selectedMemo) return;
    const result = await updateMemo(selectedMemo.id, { isPinned: !selectedMemo.isPinned });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    await refreshMemos();
  };

  const handleTrashMemo = async () => {
    if (!selectedMemo) return;
    const result = await trashMemo(selectedMemo.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("메모를 휴지통으로 이동했습니다.");
    await refreshMemos();
  };

  const handleRestoreMemo = async () => {
    if (!selectedMemo) return;
    const result = await restoreMemo(selectedMemo.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("메모를 복구했습니다.");
    await refreshMemos();
  };

  const handlePermanentDeleteMemo = async () => {
    if (!selectedMemo) return;
    const result = await permanentlyDeleteMemo(selectedMemo.id);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("메모를 영구 삭제했습니다.");
    await refreshMemos();
  };

  const handleUploadAttachment = async (file: File) => {
    if (!selectedMemo) return;
    const formData = new FormData();
    formData.set("memoId", selectedMemo.id);
    formData.set("file", file);
    const result = await uploadMemoAttachment(formData);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("첨부 파일을 업로드했습니다.");
    await queryClient.invalidateQueries({ queryKey: ["memo-attachments", selectedMemo.id] });
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    const result = await getMemoAttachmentDownloadUrl(attachmentId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    window.open(result.data.url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    const result = await deleteMemoAttachment(attachmentId);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success("첨부 파일을 삭제했습니다.");
    await queryClient.invalidateQueries({ queryKey: ["memo-attachments", selectedMemoId] });
  };

  if (folderLoading || memoLoading) {
    return <Card className="mt-4 p-6 text-sm text-[var(--color-ink-muted)]">메모 데이터를 불러오는 중입니다...</Card>;
  }

  if (isError) {
    return (
      <Card className="mt-4 p-6">
        <p className="text-sm text-[var(--color-danger)]">메모 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[260px_340px_1fr]">
      <Card className="space-y-3 p-4">
        <Button className="w-full" onClick={() => void handleCreateMemo()}>
          <Plus className="mr-1 h-4 w-4" /> 새 메모
        </Button>
        <div className="space-y-2">
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${
              folderFilter === "all"
                ? "border-[rgb(212_212_212/65%)] bg-[rgb(16_34_52/85%)]"
                : "border-[rgb(42_42_42/45%)] bg-[rgb(12_21_33/70%)]"
            }`}
            onClick={() => setFolderFilter("all")}
          >
            <span className="flex items-center gap-2">
              <Folder className="h-4 w-4" /> 전체 메모
            </span>
            <Badge tone="brand">{(memos ?? []).filter((memo) => !memo.deletedAt).length}</Badge>
          </button>
          {(folders ?? []).map((folder) => (
            <div
              key={folder.id}
              className={`rounded-xl border px-3 py-2 ${
                folderFilter === folder.id
                  ? "border-[rgb(212_212_212/65%)] bg-[rgb(16_34_52/85%)]"
                  : "border-[rgb(42_42_42/45%)] bg-[rgb(12_21_33/70%)]"
              }`}
            >
              <button type="button" className="flex w-full items-center justify-between text-sm" onClick={() => setFolderFilter(folder.id)}>
                <span className="truncate">{folder.name}</span>
                <Badge tone="neutral">{(memos ?? []).filter((memo) => memo.folderId === folder.id && !memo.deletedAt).length}</Badge>
              </button>
              <div className="mt-2 flex gap-1">
                <Button variant="ghost" className="h-7 flex-1 px-2 text-xs" onClick={() => void handleRenameFolder(folder.id, folder.name)}>
                  이름 변경
                </Button>
                <Button variant="ghost" className="h-7 px-2" onClick={() => void handleDeleteFolder(folder.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm ${
              folderFilter === "trash"
                ? "border-[rgb(255_77_109/60%)] bg-[rgb(45_15_22/75%)]"
                : "border-[rgb(42_42_42/45%)] bg-[rgb(12_21_33/70%)]"
            }`}
            onClick={() => setFolderFilter("trash")}
          >
            <span className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> 휴지통
            </span>
            <Badge tone="danger">{(memos ?? []).filter((memo) => Boolean(memo.deletedAt)).length}</Badge>
          </button>
        </div>
        <div className="rounded-xl border border-[rgb(42_42_42/45%)] p-2">
          <div className="mb-2 flex items-center gap-1 text-xs text-[var(--color-ink-muted)]">
            <FolderPlus className="h-3.5 w-3.5" /> 폴더 추가
          </div>
          <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="새 폴더 이름" />
          <Button className="mt-2 w-full" variant="outline" onClick={() => void handleCreateFolder()}>
            생성
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="메모 검색" />
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {["오늘", "어제", "지난 7일", "이번 달", "이전"].map((group) => {
            const items = groupedMemos.get(group) ?? [];
            if (!items.length) return null;
            return (
              <section key={group} className="space-y-2">
                <p className="text-xs text-[var(--color-ink-muted)]">{group}</p>
                {items.map((memo) => (
                  <button
                    key={memo.id}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      selectedMemoId === memo.id
                        ? "border-[rgb(212_212_212/65%)] bg-[rgb(16_34_52/85%)]"
                        : "border-[rgb(42_42_42/45%)] bg-[rgb(12_21_33/70%)]"
                    }`}
                    onClick={() => setSelectedMemoId(memo.id)}
                  >
                    <div className="flex items-center gap-2">
                      {memo.isPinned && !memo.deletedAt ? <Pin className="h-3.5 w-3.5 text-[var(--color-warning)]" /> : null}
                      <p className="truncate text-sm font-medium">{highlightMatch(memo.title || "제목 없음", search)}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">{highlightMatch(memo.content || "내용 없음", search)}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-ink-muted)]">
                      <span>{memo.author?.displayName ?? "작성자 없음"}</span>
                      <span>{format(parseISO(memo.updatedAt), "M/d HH:mm", { locale: ko })}</span>
                    </div>
                  </button>
                ))}
              </section>
            );
          })}

          {!filteredMemos.length ? (
            <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">조건에 맞는 메모가 없습니다.</p>
          ) : null}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        {selectedMemo ? (
          <>
            <div className="flex items-center gap-2">
              <Input value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} placeholder="제목" />
              {!selectedMemo.deletedAt ? (
                <Button variant="ghost" className="h-10 px-3" onClick={() => void handleTogglePin()}>
                  <Pin className={`h-4 w-4 ${selectedMemo.isPinned ? "text-[var(--color-warning)]" : ""}`} />
                </Button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              <span>작성자: {selectedMemo.author?.displayName ?? "알 수 없음"}</span>
              <span>수정: {format(parseISO(selectedMemo.updatedAt), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
              {saving ? <Badge tone="warning">자동 저장 중...</Badge> : <Badge tone="brand">저장됨</Badge>}
            </div>

            <textarea
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              disabled={Boolean(selectedMemo.deletedAt)}
              className="min-h-[360px] w-full rounded-xl border border-[var(--color-line-2)] bg-[rgb(14_14_14/85%)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand)] disabled:opacity-60"
              placeholder="메모 내용을 입력하세요"
            />

            {!selectedMemo.deletedAt ? (
              <div className="space-y-2 rounded-xl border border-[rgb(42_42_42/45%)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--color-ink-muted)]">첨부 파일</p>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[rgb(42_42_42/45%)] px-2 py-1 text-xs">
                    <FileUp className="h-3.5 w-3.5" /> 업로드
                    <input
                      type="file"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleUploadAttachment(file);
                          event.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="space-y-1">
                  {(attachments ?? []).map((attachment) => (
                    <div key={attachment.id} className="flex items-center justify-between rounded-lg bg-[rgb(15_24_38/80%)] px-2 py-1.5 text-xs">
                      <span className="truncate">{attachment.fileName ?? "첨부 파일"}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => void handleDownloadAttachment(attachment.id)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" className="h-7 px-2" onClick={() => void handleDeleteAttachment(attachment.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!attachments?.length ? <p className="text-xs text-[var(--color-ink-muted)]">첨부 파일이 없습니다.</p> : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              {!selectedMemo.deletedAt ? (
                <Button variant="danger" onClick={() => void handleTrashMemo()}>
                  <Trash2 className="mr-1 h-4 w-4" /> 휴지통으로 이동
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => void handleRestoreMemo()}>
                    <RotateCcw className="mr-1 h-4 w-4" /> 복구
                  </Button>
                  <Button variant="danger" onClick={() => void handlePermanentDeleteMemo()}>
                    영구 삭제
                  </Button>
                </>
              )}
            </div>
          </>
        ) : (
          <p className="rounded-xl bg-[rgb(26_26_26/72%)] px-3 py-4 text-sm text-[var(--color-ink-muted)]">선택된 메모가 없습니다.</p>
        )}
      </Card>
    </div>
  );
}
