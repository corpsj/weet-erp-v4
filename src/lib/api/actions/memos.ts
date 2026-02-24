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
  folderId: z.string().uuid().nullable().optional(),
  isPinned: z.boolean().optional(),
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
  if (!folderId) {
    return actionError("폴더를 찾을 수 없습니다.");
  }

  const parsed = folderSchema.safeParse({ name });
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memo_folders").update({ name: parsed.data.name }).eq("id", folderId);

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
  if (!folderId) {
    return actionError("폴더를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    await supabase.from("memos").update({ folder_id: null }).eq("folder_id", folderId);
    const { error } = await supabase.from("memo_folders").delete().eq("id", folderId);

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
  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("memos")
      .insert({
        title: "새 메모",
        content: "",
        folder_id: folderId ?? null,
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
  if (!memoId) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  const parsed = memoSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("memos")
      .update({
        title: parsed.data.title,
        content: parsed.data.content,
        folder_id: parsed.data.folderId,
        is_pinned: parsed.data.isPinned,
      })
      .eq("id", memoId);

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
  if (!memoId) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memos").update({ deleted_at: new Date().toISOString() }).eq("id", memoId);
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
  if (!memoId) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("memos").update({ deleted_at: null }).eq("id", memoId);
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
  if (!memoId) {
    return actionError("메모를 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data: attachments } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("memo_id", memoId);
    if (attachments && attachments.length > 0) {
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove(attachments.map((attachment) => attachment.file_path));
    }

    const { error } = await supabase.from("memos").delete().eq("id", memoId);
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
  const memoId = String(formData.get("memoId") ?? "");
  const file = formData.get("file");

  if (!memoId || !(file instanceof File)) {
    return actionError("첨부 파일 업로드 요청이 올바르지 않습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${memoId}/${Date.now()}-${randomUUID()}-${safeName}`;
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
      memo_id: memoId,
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
  if (!attachmentId) {
    return actionError("첨부 파일을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("id", attachmentId)
      .single();
    const { error } = await supabase.from("memo_attachments").delete().eq("id", attachmentId);

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
  if (!attachmentId) {
    return actionError("첨부 파일을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data } = await supabase
      .from("memo_attachments")
      .select("file_path")
      .eq("id", attachmentId)
      .single();
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
