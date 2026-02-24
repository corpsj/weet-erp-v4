"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { MemoAttachment, MemoFolder, MemoItem } from "@/types/memo";

export function useMemoFolders() {
  return useQuery({
    queryKey: ["memo-folders"],
    staleTime: 1000 * 60,
    queryFn: async (): Promise<MemoFolder[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("memo_folders")
        .select("id, name, created_by, created_at, updated_at")
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error("폴더 목록을 불러오지 못했습니다.");
      }

      return (data ?? []).map((folder) => ({
        id: folder.id,
        name: folder.name,
        createdBy: folder.created_by,
        createdAt: folder.created_at,
        updatedAt: folder.updated_at,
      }));
    },
  });
}

export function useMemos() {
  return useQuery({
    queryKey: ["memos"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<MemoItem[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("memos")
        .select(
          "id, title, content, folder_id, is_pinned, created_by, deleted_at, created_at, updated_at, app_users!memos_created_by_fkey(id, display_name, username, profile_color)",
        )
        .order("is_pinned", { ascending: false })
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error("메모를 불러오지 못했습니다.");
      }

      return (data ?? []).map((memo) => {
        const authorRow = Array.isArray(memo.app_users) ? memo.app_users[0] : memo.app_users;

        return {
          id: memo.id,
          title: memo.title,
          content: memo.content,
          folderId: memo.folder_id,
          isPinned: memo.is_pinned,
          createdBy: memo.created_by,
          deletedAt: memo.deleted_at,
          createdAt: memo.created_at,
          updatedAt: memo.updated_at,
          author: authorRow
            ? {
                id: authorRow.id,
                displayName: authorRow.display_name,
                username: authorRow.username,
                profileColor: authorRow.profile_color,
              }
            : null,
        };
      });
    },
  });
}

export function useMemoAttachments(memoId?: string) {
  return useQuery({
    queryKey: ["memo-attachments", memoId],
    enabled: Boolean(memoId),
    queryFn: async (): Promise<MemoAttachment[]> => {
      if (!memoId) {
        return [];
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("memo_attachments")
        .select("id, memo_id, file_path, file_name, file_size, created_by, created_at")
        .eq("memo_id", memoId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("첨부 파일을 불러오지 못했습니다.");
      }

      return (data ?? []).map((attachment) => ({
        id: attachment.id,
        memoId: attachment.memo_id,
        filePath: attachment.file_path,
        fileName: attachment.file_name,
        fileSize: attachment.file_size,
        createdBy: attachment.created_by,
        createdAt: attachment.created_at,
      }));
    },
  });
}
