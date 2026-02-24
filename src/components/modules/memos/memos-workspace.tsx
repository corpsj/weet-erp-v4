"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Check,
  Clock3,
  Download,
  FileText,
  FileUp,
  Folder,
  FolderOpen,
  FolderPlus,
  Maximize2,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
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
import { Modal } from "@/components/ui/modal";

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
      <mark key={part.key} className="rounded bg-[#e5e5e5] px-0.5 text-[#0a0a0a]">
        {part.value}
      </mark>
    ) : (
      <span key={part.key}>{part.value}</span>
    ),
  );
}

function formatFileSize(bytes: number | null) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

function getMemoPreview(content: string, query: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return "내용이 없습니다.";

  if (!query.trim()) {
    return normalized.slice(0, 140);
  }

  const lower = normalized.toLowerCase();
  const lowerQuery = query.trim().toLowerCase();
  const start = Math.max(0, lower.indexOf(lowerQuery) - 24);
  return normalized.slice(start, start + 160);
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const { data: folders, isLoading: folderLoading } = useMemoFolders();
  const { data: memos, isLoading: memoLoading, isError, refetch } = useMemos();
  const { data: attachments } = useMemoAttachments(selectedMemoId ?? undefined);

  useEffect(() => {
    void markMenuAsRead("memos");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 180);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void (async () => {
          const result = await createMemo(folderFilter !== "all" && folderFilter !== "trash" ? folderFilter : null);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }

          toast.success("메모를 생성했습니다.");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["memos"] }),
            queryClient.invalidateQueries({ queryKey: ["memo-folders"] }),
            queryClient.invalidateQueries({ queryKey: ["hub-snapshot"] }),
            queryClient.invalidateQueries({ queryKey: ["menu-unread-counts"] }),
          ]);

          setSelectedMemoId(result.data.id);
          setEditorModalOpen(true);
        })();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [folderFilter, queryClient]);

  const filteredMemos = useMemo(() => {
    const all = memos ?? [];
    return all.filter((memo) => {
      if (folderFilter === "trash") {
        if (!memo.deletedAt) return false;
      } else {
        if (memo.deletedAt) return false;
        if (folderFilter !== "all" && memo.folderId !== folderFilter) return false;
      }

      if (showPinnedOnly && !memo.isPinned) {
        return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const title = (memo.title ?? "").toLowerCase();
        const content = memo.content.toLowerCase();
        if (!title.includes(q) && !content.includes(q)) return false;
      }

      return true;
    });
  }, [folderFilter, memos, search, showPinnedOnly]);

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
      setLastSavedAt(null);
      setSaveFailed(false);
      return;
    }
    setEditorTitle(selectedMemo.title ?? "");
    setEditorContent(selectedMemo.content);
    setLastSavedAt(selectedMemo.updatedAt);
    setSaveFailed(false);
  }, [selectedMemo]);

  useEffect(() => {
    if (!selectedMemo || selectedMemo.deletedAt) return;
    if ((selectedMemo.title ?? "") === editorTitle && selectedMemo.content === editorContent) return;

    const timer = setTimeout(async () => {
      setSaving(true);
      setSaveFailed(false);
      const result = await updateMemo(selectedMemo.id, {
        title: editorTitle || "제목 없음",
        content: editorContent,
      });
      setSaving(false);

      if (!result.ok) {
        setSaveFailed(true);
        toast.error(result.message);
        return;
      }

      setLastSavedAt(new Date().toISOString());
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
    setEditorModalOpen(true);
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
    const confirmed = window.confirm("폴더를 삭제하면 해당 메모는 전체 메모로 이동됩니다. 삭제할까요?");
    if (!confirmed) return;

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
    const confirmed = window.confirm("이 메모를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
    if (!confirmed) return;

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
    return <Card className="mt-4 border-[#2a2a2a] bg-[#141414] p-6 text-sm text-[#b0b0b0]">메모 데이터를 불러오는 중입니다...</Card>;
  }

  if (isError) {
    return (
      <Card className="mt-4 border-[#2a2a2a] bg-[#141414] p-6">
        <p className="text-sm text-[#ff4d6d]">메모 데이터를 불러오지 못했습니다.</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="mt-4 grid gap-4 xl:grid-cols-[280px_360px_1fr]">
        <Card className="space-y-4 border-[#2a2a2a] bg-[#141414] p-4">
          <div className="space-y-2">
            <Button className="w-full" onClick={() => void handleCreateMemo()}>
              <Plus className="mr-1 h-4 w-4" /> 새 메모
            </Button>
            <p className="text-[11px] text-[#9a9a9a]">단축키: {"⌘/Ctrl + N"}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#d4d4d4]">폴더</p>
              <span className="rounded border border-[#2a2a2a] bg-[#1a1a1a] px-1.5 py-0.5 text-[11px] text-[#9a9a9a]">
                {(memos ?? []).filter((memo) => !memo.deletedAt).length}
              </span>
            </div>

            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                folderFilter === "all" ? "border-[#e5e5e5] bg-[#1a1a1a] text-[#ffffff]" : "border-[#2a2a2a] bg-[#141414] text-[#d4d4d4]"
              }`}
              onClick={() => setFolderFilter("all")}
            >
              <span className="flex items-center gap-2">
                {folderFilter === "all" ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
                전체 메모
              </span>
              <span className="text-xs text-[#9a9a9a]">{(memos ?? []).filter((memo) => !memo.deletedAt).length}</span>
            </button>

            {(folders ?? []).map((folder) => (
              <div
                key={folder.id}
                className={`rounded-md border px-2 py-2 ${
                  folderFilter === folder.id ? "border-[#e5e5e5] bg-[#1a1a1a]" : "border-[#2a2a2a] bg-[#141414]"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-1 text-left text-sm"
                  onClick={() => setFolderFilter(folder.id)}
                >
                  <span className="flex items-center gap-2 truncate text-[#d4d4d4]">
                    {folderFilter === folder.id ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
                    <span className="truncate">{folder.name}</span>
                  </span>
                  <span className="text-xs text-[#9a9a9a]">
                    {(memos ?? []).filter((memo) => memo.folderId === folder.id && !memo.deletedAt).length}
                  </span>
                </button>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => void handleRenameFolder(folder.id, folder.name)}>
                    이름 변경
                  </Button>
                  <Button variant="ghost" className="h-7 px-2 text-xs text-[#ff4d6d]" onClick={() => void handleDeleteFolder(folder.id)}>
                    삭제
                  </Button>
                </div>
              </div>
            ))}

            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                folderFilter === "trash"
                  ? "border-[#ff4d6d] bg-[#1a1a1a] text-[#ffffff]"
                  : "border-[#2a2a2a] bg-[#141414] text-[#d4d4d4]"
              }`}
              onClick={() => setFolderFilter("trash")}
            >
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> 휴지통
              </span>
              <span className="text-xs text-[#9a9a9a]">{(memos ?? []).filter((memo) => Boolean(memo.deletedAt)).length}</span>
            </button>
          </div>

          <div className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-2">
            <div className="mb-2 flex items-center gap-1 text-xs text-[#b0b0b0]">
              <FolderPlus className="h-3.5 w-3.5" /> 폴더 추가
            </div>
            <Input value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="새 폴더 이름" />
            <Button className="mt-2 w-full" variant="outline" onClick={() => void handleCreateFolder()}>
              생성
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
            <Input
              ref={searchInputRef}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-9 pr-9"
              placeholder="메모 검색 (⌘/Ctrl + F)"
            />
            {searchInput ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[#9a9a9a] hover:bg-[#2a2a2a] hover:text-[#ffffff]"
                onClick={() => setSearchInput("")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-xs ${showPinnedOnly ? "border-[#e5e5e5] bg-[#1a1a1a] text-[#ffffff]" : "border-[#2a2a2a] text-[#b0b0b0]"}`}
              onClick={() => setShowPinnedOnly((value) => !value)}
            >
              <span className="inline-flex items-center gap-1">
                <Pin className="h-3 w-3" /> 핀 고정만
              </span>
            </button>
            <span className="text-xs text-[#9a9a9a]">검색 결과 {filteredMemos.length}개</span>
          </div>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {["오늘", "어제", "지난 7일", "이번 달", "이전"].map((group) => {
              const items = groupedMemos.get(group) ?? [];
              if (!items.length) return null;
              return (
                <section key={group} className="space-y-2">
                  <div className="flex items-center gap-1 text-xs text-[#9a9a9a]">
                    <Clock3 className="h-3 w-3" /> {group}
                  </div>
                  {items.map((memo) => (
                    <button
                      key={memo.id}
                      type="button"
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        selectedMemoId === memo.id ? "border-[#e5e5e5] bg-[#1a1a1a]" : "border-[#2a2a2a] bg-[#141414]"
                      }`}
                      onClick={() => setSelectedMemoId(memo.id)}
                    >
                      <div className="flex items-center gap-2">
                        {memo.isPinned && !memo.deletedAt ? <Pin className="h-3.5 w-3.5 text-[#e5e5e5]" /> : <FileText className="h-3.5 w-3.5 text-[#9a9a9a]" />}
                        <p className="truncate text-sm font-medium text-[#e5e5e5]">{highlightMatch(memo.title || "제목 없음", search)}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[#9a9a9a]">{highlightMatch(getMemoPreview(memo.content, search), search)}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-[#9a9a9a]">
                        <span className="truncate">{memo.author?.displayName ?? "작성자 없음"}</span>
                        <span>{format(parseISO(memo.updatedAt), "M/d HH:mm", { locale: ko })}</span>
                      </div>
                    </button>
                  ))}
                </section>
              );
            })}

            {!filteredMemos.length ? (
              <p className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">조건에 맞는 메모가 없습니다.</p>
            ) : null}
          </div>
        </Card>

        <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
          {selectedMemo ? (
            <>
              <div className="flex items-center gap-2">
                <Input value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} placeholder="제목" />
                {!selectedMemo.deletedAt ? (
                  <Button variant="ghost" className="h-10 px-3" onClick={() => void handleTogglePin()}>
                    <Pin className={`h-4 w-4 ${selectedMemo.isPinned ? "text-[#ffffff]" : "text-[#9a9a9a]"}`} />
                  </Button>
                ) : null}
                {!selectedMemo.deletedAt ? (
                  <Button variant="ghost" className="h-10 px-3" onClick={() => setEditorModalOpen(true)}>
                    <Maximize2 className="h-4 w-4 text-[#9a9a9a]" />
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9a9a9a]">
                <span>작성자: {selectedMemo.author?.displayName ?? "알 수 없음"}</span>
                <span>수정: {format(parseISO(selectedMemo.updatedAt), "yyyy.MM.dd HH:mm", { locale: ko })}</span>
                {saving ? (
                  <Badge tone="neutral">자동 저장 중...</Badge>
                ) : saveFailed ? (
                  <Badge tone="danger">저장 실패</Badge>
                ) : (
                  <Badge tone="neutral">
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      {lastSavedAt ? format(parseISO(lastSavedAt), "HH:mm", { locale: ko }) : "저장됨"}
                    </span>
                  </Badge>
                )}
              </div>

              <textarea
                value={editorContent}
                onChange={(event) => setEditorContent(event.target.value)}
                disabled={Boolean(selectedMemo.deletedAt)}
                className="min-h-[300px] w-full rounded-md border border-[#3a3a3a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#e5e5e5] disabled:opacity-60"
                placeholder="메모 내용을 입력하세요"
              />

              {!selectedMemo.deletedAt ? (
                <div className="space-y-2 rounded-md border border-[#2a2a2a] bg-[#1a1a1a] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#b0b0b0]">첨부 파일 ({attachments?.length ?? 0})</p>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[#3a3a3a] px-2 py-1 text-xs text-[#d4d4d4] hover:bg-[#2a2a2a]">
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
                      <div key={attachment.id} className="flex items-center justify-between rounded-md border border-[#2a2a2a] bg-[#141414] px-2 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate text-[#d4d4d4]">{attachment.fileName ?? "첨부 파일"}</p>
                          <p className="text-[#9a9a9a]">
                            {formatFileSize(attachment.fileSize)} · {format(parseISO(attachment.createdAt), "MM.dd HH:mm", { locale: ko })}
                          </p>
                        </div>
                        <div className="ml-2 flex items-center gap-1">
                          <Button variant="ghost" className="h-7 px-2" onClick={() => void handleDownloadAttachment(attachment.id)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" className="h-7 px-2 text-[#ff4d6d]" onClick={() => void handleDeleteAttachment(attachment.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {!attachments?.length ? <p className="text-xs text-[#9a9a9a]">첨부 파일이 없습니다.</p> : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-[#ff4d6d] bg-[#1a1a1a] px-3 py-2 text-xs text-[#ff4d6d]">
                  휴지통에 있는 메모는 수정할 수 없습니다.
                </div>
              )}

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
            <p className="rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-4 text-sm text-[#9a9a9a]">선택된 메모가 없습니다.</p>
          )}
        </Card>
      </div>

      <Modal open={editorModalOpen && Boolean(selectedMemo) && !Boolean(selectedMemo?.deletedAt)} onClose={() => setEditorModalOpen(false)} title="메모 집중 편집">
        {selectedMemo ? (
          <div className="space-y-3">
            <Input value={editorTitle} onChange={(event) => setEditorTitle(event.target.value)} placeholder="제목" />
            <textarea
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              className="min-h-[420px] w-full rounded-md border border-[#3a3a3a] bg-[#0a0a0a] px-3 py-3 text-sm text-[#e5e5e5] outline-none focus:border-[#e5e5e5]"
              placeholder="메모 내용을 입력하세요"
            />
            <div className="flex items-center justify-between text-xs text-[#9a9a9a]">
              <span>{saving ? "자동 저장 중..." : saveFailed ? "저장 실패" : "자동 저장됨"}</span>
              <Button variant="outline" size="sm" onClick={() => setEditorModalOpen(false)}>
                편집 닫기
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
