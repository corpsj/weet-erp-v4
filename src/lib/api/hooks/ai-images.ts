"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SavedGeneratedImage, ImageModel, AspectRatio, ImageSize } from "@/types/ai-image";

const SIGNED_URL_EXPIRY = 60 * 60;

export function useGeneratedImages() {
  return useQuery({
    queryKey: ["ai-generated-images"],
    staleTime: 1000 * 30,
    queryFn: async (): Promise<SavedGeneratedImage[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ai_generated_images")
        .select(
          "id, prompt, file_path, text_content, model, aspect_ratio, image_size, mode, is_starred, created_by, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error("이미지 목록을 불러오지 못했습니다.");
      }

      const rows = data ?? [];
      if (!rows.length) return [];

      const filePaths = rows.map((r) => r.file_path);
      const { data: signedUrls } = await supabase.storage
        .from("ai-images")
        .createSignedUrls(filePaths, SIGNED_URL_EXPIRY);

      const urlMap = new Map<string, string>();
      if (signedUrls) {
        for (const item of signedUrls) {
          if (item.signedUrl && item.path) {
            urlMap.set(item.path, item.signedUrl);
          }
        }
      }

      return rows.map((row) => ({
        id: row.id,
        prompt: row.prompt,
        filePath: row.file_path,
        signedUrl: urlMap.get(row.file_path) ?? null,
        textContent: row.text_content,
        model: row.model as ImageModel,
        aspectRatio: row.aspect_ratio as AspectRatio,
        imageSize: row.image_size as ImageSize,
        mode: row.mode as "generate" | "edit",
        isStarred: row.is_starred,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },
  });
}
