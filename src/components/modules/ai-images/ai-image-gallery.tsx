"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Copy,
  Crown,
  Download,
  ImagePlus,
  Maximize2,
  Search,
  Sparkles,
  Square,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteGeneratedImage,
  deleteGeneratedImages,
  toggleImageStar,
} from "@/lib/api/actions/ai-images";
import { useGeneratedImages } from "@/lib/api/hooks/ai-images";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImageModel, SavedGeneratedImage } from "@/types/ai-image";

type GalleryFilter = {
  search: string;
  model: "all" | ImageModel;
  mode: "all" | "generate" | "edit";
  starredOnly: boolean;
};

type AiImageGalleryProps = {
  onLoadSettings: (img: SavedGeneratedImage) => void;
};

export function AiImageGallery({ onLoadSettings }: AiImageGalleryProps) {
  const queryClient = useQueryClient();
  const { data: savedImages, isLoading } = useGeneratedImages();

  const [filter, setFilter] = useState<GalleryFilter>({
    search: "",
    model: "all",
    mode: "all",
    starredOnly: false,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailImage, setDetailImage] = useState<SavedGeneratedImage | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  const filteredImages = useMemo(() => {
    const all = savedImages ?? [];
    return all.filter((img) => {
      if (filter.starredOnly && !img.isStarred) return false;
      if (filter.model !== "all" && img.model !== filter.model) return false;
      if (filter.mode !== "all" && img.mode !== filter.mode) return false;
      if (filter.search.trim()) {
        const q = filter.search.trim().toLowerCase();
        if (!img.prompt.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [savedImages, filter]);

  const refreshGallery = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["ai-generated-images"] });
  }, [queryClient]);

  const handleToggleStar = useCallback(
    async (imageId: string) => {
      const res = await toggleImageStar(imageId);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      await refreshGallery();
    },
    [refreshGallery],
  );

  const handleDeleteImage = useCallback(
    async (imageId: string) => {
      if (!window.confirm("이 이미지를 삭제할까요?")) return;
      setDeletingIds((prev) => new Set(prev).add(imageId));
      const res = await deleteGeneratedImage(imageId);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (detailImage?.id === imageId) setDetailImage(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      toast.success("이미지를 삭제했습니다.");
      await refreshGallery();
    },
    [refreshGallery, detailImage],
  );

  const handleBulkDelete = useCallback(async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`선택한 ${selectedIds.size}개 이미지를 삭제할까요?`)) return;
    const ids = Array.from(selectedIds);
    const res = await deleteGeneratedImages(ids);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    if (detailImage && selectedIds.has(detailImage.id)) setDetailImage(null);
    setSelectedIds(new Set());
    toast.success(`${ids.length}개 이미지를 삭제했습니다.`);
    await refreshGallery();
  }, [selectedIds, refreshGallery, detailImage]);

  const handleToggleSelect = useCallback((imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredImages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredImages.map((img) => img.id)));
    }
  }, [selectedIds.size, filteredImages]);

  const handleCopyPrompt = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("프롬프트가 복사되었습니다.");
  }, []);

  const totalCount = savedImages?.length ?? 0;
  const filteredCount = filteredImages.length;
  const isSelectMode = selectedIds.size > 0;

  return (
    <>
      <div className="mt-4 space-y-4">
        <Card className="border-[#2a2a2a] bg-[#141414] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9a9a]" />
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
                placeholder="프롬프트로 검색..."
                className="w-full rounded-md border border-[#2a2a2a] bg-[#0a0a0a] py-2 pl-9 pr-3 text-sm text-[#e5e5e5] outline-none placeholder:text-[#9a9a9a] focus:border-[#3a3a3a]"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilter((f) => ({ ...f, starredOnly: !f.starredOnly }))}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                filter.starredOnly
                  ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-400"
                  : "border-[#2a2a2a] text-[#9a9a9a] hover:border-[#3a3a3a] hover:text-[#d4d4d4]"
              }`}
            >
              <Star className={`inline-block h-4 w-4 ${filter.starredOnly ? "fill-yellow-400" : ""}`} />
            </button>

            <select
              value={filter.model}
              onChange={(e) => setFilter((f) => ({ ...f, model: e.target.value as GalleryFilter["model"] }))}
              className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#3a3a3a]"
            >
              <option value="all">모든 모델</option>
              <option value="flash">Flash</option>
              <option value="pro">Pro</option>
            </select>

            <select
              value={filter.mode}
              onChange={(e) => setFilter((f) => ({ ...f, mode: e.target.value as GalleryFilter["mode"] }))}
              className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2 text-sm text-[#e5e5e5] outline-none focus:border-[#3a3a3a]"
            >
              <option value="all">생성+편집</option>
              <option value="generate">생성만</option>
              <option value="edit">편집만</option>
            </select>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[#9a9a9a]">
                {filteredCount !== totalCount ? `${filteredCount} / ${totalCount}` : `${totalCount}개`}
              </span>
              {isSelectMode && (
                <>
                  <span className="text-xs text-[#e5e5e5]">{selectedIds.size}개 선택</span>
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                    {selectedIds.size === filteredImages.length ? "선택 해제" : "전체 선택"}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => void handleBulkDelete()}>
                    <Trash2 className="mr-1 h-3 w-3" /> 삭제
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        {detailImage && (
          <Card className="border-[#2a2a2a] bg-[#141414] p-0 overflow-hidden">
            <div className="grid lg:grid-cols-[1fr_360px]">
              <div className="group relative flex items-center justify-center bg-[#0a0a0a] p-4">
                {detailImage.signedUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detailImage.signedUrl}
                      alt={detailImage.prompt.slice(0, 50)}
                      className="max-h-[60vh] cursor-pointer rounded-md object-contain"
                      onClick={() => setFullscreenUrl(detailImage.signedUrl)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setFullscreenUrl(detailImage.signedUrl);
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3 rounded-md bg-[#141414]/80 p-2 text-[#9a9a9a] opacity-0 transition-opacity hover:text-[#ffffff] group-hover:opacity-100"
                      onClick={() => setFullscreenUrl(detailImage.signedUrl)}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-40 items-center justify-center">
                    <ImagePlus className="h-10 w-10 text-[#2a2a2a]" />
                  </div>
                )}
              </div>

              <div className="border-t border-[#2a2a2a] p-5 lg:border-l lg:border-t-0">
                <div className="flex items-start justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={detailImage.mode === "generate" ? "brand" : "warning"}>
                      {detailImage.mode === "generate" ? "생성" : "편집"}
                    </Badge>
                    <Badge tone="neutral">
                      {detailImage.model === "flash" ? (
                        <><Zap className="mr-1 h-3 w-3" />Flash</>
                      ) : (
                        <><Crown className="mr-1 h-3 w-3" />Pro</>
                      )}
                    </Badge>
                    <Badge tone="neutral">{detailImage.aspectRatio}</Badge>
                    <Badge tone="neutral">{detailImage.imageSize}</Badge>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1 text-[#9a9a9a] transition-colors hover:text-[#ffffff]"
                    onClick={() => setDetailImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#9a9a9a]">프롬프트</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#e5e5e5]">{detailImage.prompt}</p>
                </div>

                {detailImage.textContent && (
                  <div className="mt-3 rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[#9a9a9a]">AI 응답</p>
                    <p className="whitespace-pre-wrap text-sm text-[#d4d4d4]">{detailImage.textContent}</p>
                  </div>
                )}

                <p className="mt-3 text-[10px] text-[#9a9a9a]">
                  {new Date(detailImage.createdAt).toLocaleString("ko-KR")}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onLoadSettings(detailImage);
                    }}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" /> 이 설정으로 생성
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyPrompt(detailImage.prompt)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> 프롬프트 복사
                  </Button>
                  {detailImage.signedUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = detailImage.signedUrl!;
                        a.download = `ai-image-${detailImage.id.slice(0, 8)}.png`;
                        a.click();
                      }}
                    >
                      <Download className="mr-1 h-3.5 w-3.5" /> 다운로드
                    </Button>
                  )}
                  <button
                    type="button"
                    className={`rounded-md p-2 transition-colors ${
                      detailImage.isStarred
                        ? "text-yellow-400 hover:text-yellow-300"
                        : "text-[#9a9a9a] hover:text-yellow-400"
                    }`}
                    onClick={() => void handleToggleStar(detailImage.id)}
                  >
                    <Star className={`h-4 w-4 ${detailImage.isStarred ? "fill-yellow-400" : ""}`} />
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#ff4d6d] hover:text-[#ff4d6d]"
                    onClick={() => void handleDeleteImage(detailImage.id)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> 삭제
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e5e5e5] border-r-transparent" />
            <span className="ml-3 text-sm text-[#9a9a9a]">갤러리 불러오는 중...</span>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ImagePlus className="h-16 w-16 text-[#2a2a2a]" />
            <p className="mt-4 text-sm text-[#9a9a9a]">
              {totalCount === 0
                ? "아직 생성된 이미지가 없습니다. 이미지를 생성하면 여기에 자동으로 저장됩니다."
                : "필터 조건에 맞는 이미지가 없습니다"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filteredImages.map((img) => (
              <div key={img.id} className="group relative">
                <button
                  type="button"
                  className={`w-full overflow-hidden rounded-lg border-2 transition-all ${
                    detailImage?.id === img.id
                      ? "border-[#e5e5e5] ring-1 ring-[#e5e5e5]/20"
                      : selectedIds.has(img.id)
                        ? "border-blue-500 ring-1 ring-blue-500/20"
                        : "border-[#2a2a2a] hover:border-[#4a4a4a]"
                  }`}
                  onClick={() => setDetailImage(img)}
                >
                  {img.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.signedUrl}
                      alt={img.prompt.slice(0, 50)}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-[#0a0a0a]">
                      <ImagePlus className="h-8 w-8 text-[#2a2a2a]" />
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  className={`absolute left-1.5 top-1.5 rounded p-0.5 transition-opacity ${
                    isSelectMode || selectedIds.has(img.id)
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  } ${
                    selectedIds.has(img.id)
                      ? "bg-blue-500 text-white"
                      : "bg-[#0a0a0a]/80 text-[#9a9a9a] hover:text-[#ffffff]"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(img.id);
                  }}
                >
                  {selectedIds.has(img.id) ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>

                {img.isStarred && (
                  <div className="absolute right-1.5 top-1.5">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 drop-shadow" />
                  </div>
                )}

                <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    className="rounded bg-[#0a0a0a]/80 p-1 text-[#9a9a9a] hover:text-yellow-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleToggleStar(img.id);
                    }}
                  >
                    <Star className={`h-3.5 w-3.5 ${img.isStarred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                  </button>
                  <button
                    type="button"
                    className={`rounded bg-[#0a0a0a]/80 p-1 text-[#9a9a9a] hover:text-[#ff4d6d] ${
                      deletingIds.has(img.id) ? "pointer-events-none opacity-50" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteImage(img.id);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-1.5 flex items-center gap-1">
                  <Badge
                    tone={img.mode === "generate" ? "brand" : "warning"}
                    className="h-4 px-1 text-[8px]"
                  >
                    {img.mode === "generate" ? "생성" : "편집"}
                  </Badge>
                  <span className="truncate text-[9px] text-[#9a9a9a]">
                    {img.model === "flash" ? "Flash" : "Pro"}
                  </span>
                  <span className="ml-auto text-[9px] text-[#9a9a9a]">{img.aspectRatio}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fullscreenUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/95 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setFullscreenUrl(null)}
            aria-label="닫기"
          />
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-md bg-[#1a1a1a] p-2 text-[#9a9a9a] hover:text-[#ffffff]"
            onClick={() => setFullscreenUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenUrl}
            alt="전체 화면"
            className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />
        </div>
      )}
    </>
  );
}
