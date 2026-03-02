"use server";

import { z } from "zod";
import { actionError, actionSuccess, type ActionResult } from "@/lib/api/action-result";
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
