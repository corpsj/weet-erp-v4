"use server";

import { randomUUID } from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import type { UtilityAnalysisResult, UtilityBillInput } from "@/types/utility";

const UTILITY_BILL_BUCKET = "utility-bills";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

const categorySchema = z.enum(["전기", "수도", "가스", "인터넷", "기타"]);
const processingSchema = z.enum(["processed", "manual", "processing"]);

const utilityBillSchema = z.object({
  category: categorySchema,
  billing_month: z.string().regex(/^\d{4}-\d{2}$/, "청구 월 형식은 YYYY-MM 이어야 합니다."),
  amount: z.number().nonnegative("금액은 0 이상이어야 합니다."),
  memo: z.string().max(6000, "메모가 너무 깁니다.").optional(),
  image_path: z.string().nullable().optional(),
  processing_status: processingSchema.optional(),
  is_paid: z.boolean().optional(),
});

function monthToDateString(month: string) {
  return `${month}-01`;
}

function dateToMonth(value: string) {
  return value.slice(0, 7);
}

function normalizeAnalysis(raw: unknown): UtilityAnalysisResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const parsed = z
    .object({
      category: categorySchema,
      billing_month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: z.number().nonnegative(),
    })
    .safeParse({
      category: value.category,
      billing_month: value.billing_month,
      amount: Number(value.amount),
    });

  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function extractJsonPayload(message: string) {
  const trimmed = message.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    return fenced[1];
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

async function resolveOpenRouterModel() {
  try {
    const { supabase } = await getActionContext();
    const { data: aiModelData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_model")
      .maybeSingle();

    const aiValue = aiModelData?.value;
    if (typeof aiValue === "string" && aiValue.trim()) {
      return aiValue.trim();
    }
    if (aiValue && typeof aiValue === "object") {
      const model = (aiValue as Record<string, unknown>).model;
      if (typeof model === "string" && model.trim()) {
        return model.trim();
      }
    }

    const { data: legacyData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "openrouter_model")
      .maybeSingle();

    const legacyValue = legacyData?.value;
    if (typeof legacyValue === "string" && legacyValue.trim()) {
      return legacyValue.trim();
    }
    if (legacyValue && typeof legacyValue === "object") {
      const model = (legacyValue as Record<string, unknown>).model;
      if (typeof model === "string" && model.trim()) {
        return model.trim();
      }
    }
  } catch {
    return DEFAULT_OPENROUTER_MODEL;
  }

  return DEFAULT_OPENROUTER_MODEL;
}

export async function createUtilityBill(input: UtilityBillInput): Promise<ActionResult<{ id: string }>> {
  const parsed = utilityBillSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const { data, error } = await supabase
      .from("utility_bills")
      .insert({
        category: parsed.data.category,
        billing_month: monthToDateString(parsed.data.billing_month),
        amount: parsed.data.amount,
        memo: parsed.data.memo?.trim() || null,
        image_path: parsed.data.image_path ?? null,
        processing_status: parsed.data.processing_status ?? "manual",
        is_paid: parsed.data.is_paid ?? false,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      return actionError("공과금 등록에 실패했습니다.");
    }

    revalidatePath("/utilities");
    revalidatePath("/hub");
    return actionSuccess({ id: data.id });
  } catch {
    return actionError("공과금 등록 중 오류가 발생했습니다.");
  }
}

export async function updateUtilityBill(billId: string, input: UtilityBillInput): Promise<ActionResult> {
  if (!billId) {
    return actionError("수정할 공과금 항목을 찾을 수 없습니다.");
  }

  const parsed = utilityBillSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase
      .from("utility_bills")
      .update({
        category: parsed.data.category,
        billing_month: monthToDateString(parsed.data.billing_month),
        amount: parsed.data.amount,
        memo: parsed.data.memo?.trim() || null,
        image_path: parsed.data.image_path ?? null,
        processing_status: parsed.data.processing_status ?? "manual",
        is_paid: parsed.data.is_paid ?? false,
      })
      .eq("id", billId);

    if (error) {
      return actionError("공과금 수정에 실패했습니다.");
    }

    revalidatePath("/utilities");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("공과금 수정 중 오류가 발생했습니다.");
  }
}

export async function updateUtilityBillMemo(billId: string, memo: string): Promise<ActionResult> {
  if (!billId) {
    return actionError("수정할 공과금 항목을 찾을 수 없습니다.");
  }

  if (memo.length > 6000) {
    return actionError("메모가 너무 깁니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("utility_bills").update({ memo: memo.trim() || null }).eq("id", billId);
    if (error) {
      return actionError("메모 자동 저장에 실패했습니다.");
    }

    revalidatePath("/utilities");
    return actionSuccess(undefined);
  } catch {
    return actionError("메모 자동 저장 중 오류가 발생했습니다.");
  }
}

export async function toggleUtilityBillPaid(billId: string, isPaid: boolean): Promise<ActionResult> {
  if (!billId) {
    return actionError("상태를 변경할 공과금 항목을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { error } = await supabase.from("utility_bills").update({ is_paid: isPaid }).eq("id", billId);

    if (error) {
      return actionError("납부 상태 변경에 실패했습니다.");
    }

    revalidatePath("/utilities");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("납부 상태 변경 중 오류가 발생했습니다.");
  }
}

export async function deleteUtilityBill(billId: string): Promise<ActionResult> {
  if (!billId) {
    return actionError("삭제할 공과금 항목을 찾을 수 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data } = await supabase.from("utility_bills").select("image_path").eq("id", billId).single();
    const { error } = await supabase.from("utility_bills").delete().eq("id", billId);

    if (error) {
      return actionError("공과금 삭제에 실패했습니다.");
    }

    if (data?.image_path) {
      await supabase.storage.from(UTILITY_BILL_BUCKET).remove([data.image_path]);
    }

    revalidatePath("/utilities");
    revalidatePath("/hub");
    return actionSuccess(undefined);
  } catch {
    return actionError("공과금 삭제 중 오류가 발생했습니다.");
  }
}

export async function uploadUtilityBillImage(file: File): Promise<ActionResult<{ filePath: string }>> {
  if (!(file instanceof File)) {
    return actionError("고지서 이미지 파일이 필요합니다.");
  }

  try {
    const { supabase, user } = await getActionContext();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/utility-bills/${Date.now()}-${randomUUID()}-${safeName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage.from(UTILITY_BILL_BUCKET).upload(filePath, Buffer.from(arrayBuffer), {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      return actionError("고지서 이미지 업로드에 실패했습니다.");
    }

    return actionSuccess({ filePath });
  } catch {
    return actionError("고지서 이미지 업로드 중 오류가 발생했습니다.");
  }
}

export async function getUtilityBillImageSignedUrl(imagePath: string): Promise<ActionResult<{ url: string }>> {
  if (!imagePath) {
    return actionError("이미지 경로가 없습니다.");
  }

  try {
    const { supabase } = await getActionContext();
    const { data, error } = await supabase.storage.from(UTILITY_BILL_BUCKET).createSignedUrl(imagePath, 60 * 5);

    if (error || !data?.signedUrl) {
      return actionError("이미지 미리보기 링크 생성에 실패했습니다.");
    }

    return actionSuccess({ url: data.signedUrl });
  } catch {
    return actionError("이미지 링크 생성 중 오류가 발생했습니다.");
  }
}

export async function analyzeUtilityBill(imageBase64: string, mimeType: string): Promise<ActionResult<UtilityAnalysisResult>> {
  if (!imageBase64 || !mimeType) {
    return actionError("이미지 분석 요청이 올바르지 않습니다.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return actionError("OPENROUTER_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const model = await resolveOpenRouterModel();
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              {
                type: "text",
                text: "Analyze this Korean utility bill. Extract and return JSON: { \"category\": \"전기|수도|가스|인터넷|기타\", \"billing_month\": \"YYYY-MM\", \"amount\": number }. Return ONLY the JSON.",
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return actionError("AI 고지서 분석 요청에 실패했습니다.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return actionError("AI 분석 결과를 읽지 못했습니다.");
    }

    const jsonText = extractJsonPayload(content);
    const parsed = normalizeAnalysis(JSON.parse(jsonText));

    if (!parsed) {
      return actionError("AI 분석 결과 형식이 올바르지 않습니다.");
    }

    return actionSuccess(parsed);
  } catch {
    return actionError("AI 분석 중 오류가 발생했습니다.");
  }
}

export { dateToMonth };
