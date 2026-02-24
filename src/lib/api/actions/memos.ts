"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";

const folderSchema = z.object({
  name: z.string().trim().min(1, "폴더 이름을 입력해주세요.").max(40, "폴더 이름은 40자 이하로 입력해주세요."),
});

const memoSchema = z.object({
  title: z.string().max(160, "제목이 너무 깁니다.").optional(),
  content: z.string().max(80_000, "메모 내용이 너무 깁니다.").optional(),
  folderId: z.uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
});

const idSchema = z.uuid({ error: "잘못된 요청입니다." });

const createMemoSchema = z.object({
  folderId: z.uuid().nullable().optional(),
});

const ATTACHMENT_BUCKET = "attachments";

export async function createMemoFolder(name: string): Promise<ActionResult<{ id: string }>> {
  const parsed = folderSchema.safeParse({ name });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("memo_folders")
      .insert({
        name: parsed.data.name,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("폴더 생성에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("폴더 생성 중 오류가 발생했습니다.");
  }
}

export async function renameMemoFolder(folderId: string, name: string): Promise<ActionResult> {
  const parsedFolderId = idSchema.safeParse(folderId);
  if (!parsedFolderId.success) {
    return actionError("폴더를 찾을 수 없습니다.");
  }

  const parsed = folderSchema.safeParse({ name });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memo_folders").update({ name: parsed.data.name }).eq("id", parsedFolderId.data);

    if (error) {
      return actionError("폴더 이름 변경에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("폴더 이름 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteMemoFolder(folderId: string): Promise<ActionResult> {
  const parsedFolderId = idSchema.safeParse(folderId);
  if (!parsedFolderId.success) {
    return actionError("폴더를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error: clearError } = await supabase.from("memos").update({ folder_id: null }).eq("folder_id", parsedFolderId.data);
    if (clearError) {
      return actionError("폴더 내 메모 정리에 실패했습니다.");
    }

    const { error } = await supabase.from("memo_folders").delete().eq("id", parsedFolderId.data);

    if (error) {
      return actionError("폴더 삭제에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("폴더 삭제 중 오류가 발생했습니다.");
  }
}

export async function createMemo(folderId?: string | null): Promise<ActionResult<{ id: string }>> {
  const parsedInput = createMemoSchema.safeParse({ folderId: folderId ?? null });
  if (!parsedInput.success) {
    return actionError(parsedInput.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("memos")
      .insert({
        title: "새 메모",
        content: "",
        folder_id: parsedInput.data.folderId ?? null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("메모 생성에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("메모 생성 중 오류가 발생했습니다.");
  }
}

export async function updateMemo(memoId: string, input: unknown): Promise<ActionResult> {
  const parsedMemoId = idSchema.safeParse(memoId);
  if (!parsedMemoId.success) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  const parsed = memoSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();

    const payload: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) payload.title = parsed.data.title;
    if (parsed.data.content !== undefined) payload.content = parsed.data.content;
    if (parsed.data.folderId !== undefined) payload.folder_id = parsed.data.folderId;
    if (parsed.data.isPinned !== undefined) payload.is_pinned = parsed.data.isPinned;

    if (!Object.keys(payload).length) {
      return actionError("변경할 항목이 없습니다.");
    }

    const { error } = await supabase
      .from("memos")
      .update(payload)
      .eq("id", parsedMemoId.data);

    if (error) {
      return actionError("메모 저장에 실패했습니다.");
    }

    revalidatePath("/memos");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("메모 저장 중 오류가 발생했습니다.");
  }
}

export async function trashMemo(memoId: string): Promise<ActionResult> {
  const parsedMemoId = idSchema.safeParse(memoId);
  if (!parsedMemoId.success) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memos").update({ deleted_at: new Date().toISOString() }).eq("id", parsedMemoId.data);
    if (error) {
      return actionError("메모 삭제에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("메모 삭제 중 오류가 발생했습니다.");
  }
}

export async function restoreMemo(memoId: string): Promise<ActionResult> {
  const parsedMemoId = idSchema.safeParse(memoId);
  if (!parsedMemoId.success) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memos").update({ deleted_at: null }).eq("id", parsedMemoId.data);
    if (error) {
      return actionError("메모 복구에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("메모 복구 중 오류가 발생했습니다.");
  }
}

export async function permanentlyDeleteMemo(memoId: string): Promise<ActionResult> {
  const parsedMemoId = idSchema.safeParse(memoId);
  if (!parsedMemoId.success) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data: attachments, error: attachmentReadError } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("memo_id", parsedMemoId.data);

    if (attachmentReadError) {
      return actionError("첨부 파일 조회에 실패했습니다.");
    }

    if (attachments && attachments.length > 0) {
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(attachments.map((attachment) => attachment.file_path));

      if (storageError) {
        return actionError("첨부 파일 삭제에 실패했습니다.");
      }
    }

    const { error } = await supabase.from("memos").delete().eq("id", parsedMemoId.data);
    if (error) {
      return actionError("메모 영구 삭제에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("메모 영구 삭제 중 오류가 발생했습니다.");
  }
}

export async function uploadMemoAttachment(formData: FormData): Promise<ActionResult> {
  const memoId = String(formData.get("memoId") ?? "").trim();
  const file = formData.get("file");

  const parsedMemoId = idSchema.safeParse(memoId);
  if (!parsedMemoId.success || !(file instanceof File)) {
    return actionError("첨부 파일 업로드 요청이 올바르지 않습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${parsedMemoId.data}/${Date.now()}-${randomUUID()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .upload(filePath, Buffer.from(arrayBuffer), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      return actionError("파일 업로드에 실패했습니다.");
    }

    const { error: insertError } = await supabase.from("memo_attachments").insert({
      memo_id: parsedMemoId.data,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      created_by: user.id,
    });

    if (insertError) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([filePath]);
      return actionError("첨부 정보 저장에 실패했습니다.");
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("첨부 파일 처리 중 오류가 발생했습니다.");
  }
}

export async function deleteMemoAttachment(attachmentId: string): Promise<ActionResult> {
  const parsedAttachmentId = idSchema.safeParse(attachmentId);
  if (!parsedAttachmentId.success) {
    return actionError("첨부 파일을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data, error: selectError } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("id", parsedAttachmentId.data)
      .single();

    if (selectError) {
      return actionError("첨부 파일 정보를 찾을 수 없습니다.");
    }

    const { error } = await supabase.from("memo_attachments").delete().eq("id", parsedAttachmentId.data);

    if (error) {
      return actionError("첨부 삭제에 실패했습니다.");
    }

    if (data?.file_path) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([data.file_path]);
    }

    revalidatePath("/memos");
    return actionSuccess(undefined);
  } catch {
    return actionError("첨부 삭제 중 오류가 발생했습니다.");
  }
}

export async function getMemoAttachmentDownloadUrl(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  const parsedAttachmentId = idSchema.safeParse(attachmentId);
  if (!parsedAttachmentId.success) {
    return actionError("첨부 파일을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data, error: selectError } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("id", parsedAttachmentId.data)
      .single();

    if (selectError) {
      return actionError("첨부 파일 정보를 찾을 수 없습니다.");
    }

    if (!data?.file_path) {
      return actionError("첨부 파일 경로를 찾을 수 없습니다.");
    }

    const { data: signed, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(data.file_path, 60 * 5);

    if (error || !signed?.signedUrl) {
      return actionError("다운로드 링크 생성에 실패했습니다.");
    }

    return actionSuccess({ url: signed.signedUrl });
  } catch {
    return actionError("다운로드 링크 생성 중 오류가 발생했습니다.");
  }
}
