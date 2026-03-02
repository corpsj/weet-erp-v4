"use server";

import { randomUUID } from "crypto";
import { z } from "zod";

import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
import { getActionContext } from "@/lib/api/actions/shared";
import { IMAGE_MODELS, type ImageGenerationResult } from "@/types/ai-image";

const modelSchema = z.enum(["flash", "pro"]);
const aspectRatioSchema = z.enum(["1:1", "16:9", "9:16", "4:3", "3:2", "2:3", "4:5", "21:9"]);
const imageSizeSchema = z.enum(["1K", "2K", "4K"]);

const generateSchema = z.object({
  prompt: z.string().min(1, "프롬프트를 입력해주세요.").max(10000, "프롬프트가 너무 깁니다."),
  model: modelSchema,
  aspectRatio: aspectRatioSchema,
  imageSize: imageSizeSchema,
});

const editSchema = z.object({
  imageBase64: z.string().min(1, "편집할 이미지가 필요합니다."),
  mimeType: z.string().min(1),
  instruction: z.string().min(1, "편집 지시사항을 입력해주세요.").max(10000, "지시사항이 너무 깁니다."),
  model: modelSchema,
  aspectRatio: aspectRatioSchema,
  imageSize: imageSizeSchema,
});

type OpenRouterImagePart = {
  type: string;
  image_url: { url: string };
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      images?: OpenRouterImagePart[];
    };
  }>;
  error?: { message?: string };
};

function getModelId(model: "flash" | "pro"): string {
  return IMAGE_MODELS.find((m) => m.value === model)?.modelId ?? IMAGE_MODELS[0].modelId;
}

export async function generateImage(input: {
  prompt: string;
  model: "flash" | "pro";
  aspectRatio: string;
  imageSize: string;
}): Promise<ActionResult<ImageGenerationResult>> {
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return actionError("OPENROUTER_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModelId(parsed.data.model),
        messages: [
          {
            role: "user",
            content: parsed.data.prompt,
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: parsed.data.aspectRatio,
          image_size: parsed.data.imageSize,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as OpenRouterResponse | null;
      const msg = errorBody?.error?.message ?? `API 요청 실패 (${response.status})`;
      return actionError(`이미지 생성에 실패했습니다: ${msg}`);
    }

    const payload = (await response.json()) as OpenRouterResponse;
    const message = payload.choices?.[0]?.message;

    if (!message) {
      return actionError("AI 응답을 읽지 못했습니다.");
    }

    const images = message.images ?? [];
    if (!images.length) {
      return actionError("이미지가 생성되지 않았습니다. 프롬프트를 수정해 다시 시도해주세요.");
    }

    return actionSuccess({
      imageDataUrl: images[0].image_url.url,
      textContent: message.content ?? null,
    });
  } catch {
    return actionError("이미지 생성 중 오류가 발생했습니다.");
  }
}

export async function editImage(input: {
  imageBase64: string;
  mimeType: string;
  instruction: string;
  model: "flash" | "pro";
  aspectRatio: string;
  imageSize: string;
}): Promise<ActionResult<ImageGenerationResult>> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return actionError("OPENROUTER_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModelId(parsed.data.model),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: parsed.data.instruction,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${parsed.data.mimeType};base64,${parsed.data.imageBase64}`,
                },
              },
            ],
          },
        ],
        modalities: ["image", "text"],
        image_config: {
          aspect_ratio: parsed.data.aspectRatio,
          image_size: parsed.data.imageSize,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as OpenRouterResponse | null;
      const msg = errorBody?.error?.message ?? `API 요청 실패 (${response.status})`;
      return actionError(`이미지 편집에 실패했습니다: ${msg}`);
    }

    const payload = (await response.json()) as OpenRouterResponse;
    const message = payload.choices?.[0]?.message;

    if (!message) {
      return actionError("AI 응답을 읽지 못했습니다.");
    }

    const images = message.images ?? [];
    if (!images.length) {
      return actionError("이미지가 생성되지 않았습니다. 지시사항을 수정해 다시 시도해주세요.");
    }

    return actionSuccess({
      imageDataUrl: images[0].image_url.url,
      textContent: message.content ?? null,
    });
  } catch {
    return actionError("이미지 편집 중 오류가 발생했습니다.");
  }
}

const AI_IMAGES_BUCKET = "ai-images";

const saveSchema = z.object({
  imageDataUrl: z.string().min(1),
  prompt: z.string().min(1).max(10000),
  textContent: z.string().nullable(),
  model: modelSchema,
  aspectRatio: aspectRatioSchema,
  imageSize: imageSizeSchema,
  mode: z.enum(["generate", "edit"]),
});

const idSchema = z.uuid({ error: "잘못된 요청입니다." });

export async function saveGeneratedImage(input: {
  imageDataUrl: string;
  prompt: string;
  textContent: string | null;
  model: "flash" | "pro";
  aspectRatio: string;
  imageSize: string;
  mode: "generate" | "edit";
}): Promise<ActionResult<{ id: string }>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "입력값을 확인해주세요.");
  }

  try {
    const { supabase, user } = await getActionContext();

    const base64Match = parsed.data.imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (!base64Match?.[1]) {
      return actionError("이미지 데이터가 올바르지 않습니다.");
    }

    const buffer = Buffer.from(base64Match[1], "base64");
    const filePath = `${user.id}/${Date.now()}-${randomUUID()}.png`;

    const { error: uploadError } = await supabase.storage
      .from(AI_IMAGES_BUCKET)
      .upload(filePath, buffer, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/png",
      });

    if (uploadError) {
      return actionError("이미지 업로드에 실패했습니다.");
    }

    const { data, error: insertError } = await supabase
      .from("ai_generated_images")
      .insert({
        prompt: parsed.data.prompt,
        file_path: filePath,
        text_content: parsed.data.textContent,
        model: parsed.data.model,
        aspect_ratio: parsed.data.aspectRatio,
        image_size: parsed.data.imageSize,
        mode: parsed.data.mode,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError || !data) {
      await supabase.storage.from(AI_IMAGES_BUCKET).remove([filePath]);
      return actionError("이미지 정보 저장에 실패했습니다.");
    }

    return actionSuccess({ id: data.id });
  } catch {
    return actionError("이미지 저장 중 오류가 발생했습니다.");
  }
}

export async function deleteGeneratedImage(imageId: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(imageId);
  if (!parsedId.success) {
    return actionError("이미지를 찾을 수 없습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();

    const { data, error: selectError } = await supabase
      .from("ai_generated_images")
      .select("file_path")
      .eq("id", parsedId.data)
      .eq("created_by", user.id)
      .single();

    if (selectError || !data) {
      return actionError("이미지를 찾을 수 없습니다.");
    }

    const { error: deleteError } = await supabase
      .from("ai_generated_images")
      .delete()
      .eq("id", parsedId.data)
      .eq("created_by", user.id);

    if (deleteError) {
      return actionError("이미지 삭제에 실패했습니다.");
    }

    if (data.file_path) {
      await supabase.storage.from(AI_IMAGES_BUCKET).remove([data.file_path]);
    }

    return actionSuccess(undefined);
  } catch {
    return actionError("이미지 삭제 중 오류가 발생했습니다.");
  }
}

export async function deleteGeneratedImages(imageIds: string[]): Promise<ActionResult> {
  if (!imageIds.length) {
    return actionError("삭제할 이미지를 선택해주세요.");
  }

  const parsedIds = imageIds.map((id) => idSchema.safeParse(id));
  if (parsedIds.some((p) => !p.success)) {
    return actionError("잘못된 요청입니다.");
  }

  const validIds = parsedIds.map((p) => (p as { success: true; data: string }).data);

  try {
    const { supabase, user } = await getActionContext();

    const { data: rows, error: selectError } = await supabase
      .from("ai_generated_images")
      .select("id, file_path")
      .in("id", validIds)
      .eq("created_by", user.id);

    if (selectError) {
      return actionError("이미지 정보를 불러오지 못했습니다.");
    }

    const foundIds = (rows ?? []).map((r) => r.id);
    if (!foundIds.length) {
      return actionError("삭제할 이미지를 찾을 수 없습니다.");
    }

    const { error: deleteError } = await supabase
      .from("ai_generated_images")
      .delete()
      .in("id", foundIds)
      .eq("created_by", user.id);

    if (deleteError) {
      return actionError("이미지 삭제에 실패했습니다.");
    }

    const filePaths = (rows ?? []).map((r) => r.file_path).filter(Boolean);
    if (filePaths.length) {
      await supabase.storage.from(AI_IMAGES_BUCKET).remove(filePaths);
    }

    return actionSuccess(undefined);
  } catch {
    return actionError("이미지 삭제 중 오류가 발생했습니다.");
  }
}

export async function toggleImageStar(imageId: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(imageId);
  if (!parsedId.success) {
    return actionError("이미지를 찾을 수 없습니다.");
  }

  try {
    const { supabase, user } = await getActionContext();

    const { data: current, error: selectError } = await supabase
      .from("ai_generated_images")
      .select("is_starred")
      .eq("id", parsedId.data)
      .eq("created_by", user.id)
      .single();

    if (selectError || !current) {
      return actionError("이미지를 찾을 수 없습니다.");
    }

    const { error: updateError } = await supabase
      .from("ai_generated_images")
      .update({ is_starred: !current.is_starred })
      .eq("id", parsedId.data)
      .eq("created_by", user.id);

    if (updateError) {
      return actionError("즐겨찾기 변경에 실패했습니다.");
    }

    return actionSuccess(undefined);
  } catch {
    return actionError("즐겨찾기 변경 중 오류가 발생했습니다.");
  }
}
