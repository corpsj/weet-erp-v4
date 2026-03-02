"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Crown,
  Download,
  ImagePlus,
  Maximize2,
  Paintbrush,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { generateImage, editImage } from "@/lib/api/actions/ai-images";
import type { ActionResult } from "@/lib/api/action-result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IMAGE_MODELS,
  ASPECT_RATIOS,
  IMAGE_SIZES,
  type ImageModel,
  type AspectRatio,
  type ImageSize,
  type ImageGenerationResult,
  type GeneratedImage,
} from "@/types/ai-image";

const HISTORY_KEY = "weet-erp-ai-image-history";
const MAX_HISTORY = 50;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("변환 실패"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("변환 실패"));
    reader.readAsDataURL(file);
  });
}

function loadHistory(): GeneratedImage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as GeneratedImage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: GeneratedImage[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    void 0;
  }
}

function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function AspectRatioButton({
  ratio,
  selected,
  onClick,
}: {
  ratio: { value: AspectRatio; label: string };
  selected: boolean;
  onClick: () => void;
}) {
  const [w, h] = ratio.value.split(":").map(Number);
  const maxDim = 22;
  const scale = maxDim / Math.max(w, h);
  const boxW = Math.max(6, Math.round(w * scale));
  const boxH = Math.max(6, Math.round(h * scale));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-md border px-2.5 py-2 transition-colors ${
        selected
          ? "border-[#e5e5e5] bg-[#1a1a1a] text-[#ffffff]"
          : "border-[#2a2a2a] bg-[#141414] text-[#9a9a9a] hover:border-[#3a3a3a] hover:text-[#d4d4d4]"
      }`}
    >
      <div
        className={`border ${selected ? "border-[#e5e5e5]" : "border-[#9a9a9a]"}`}
        style={{ width: boxW, height: boxH }}
      />
      <span className="text-[10px]">{ratio.label}</span>
    </button>
  );
}

export function AiImagesWorkspace() {
  const [mode, setMode] = useState<"generate" | "edit">("generate");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("flash");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imageSize, setImageSize] = useState<ImageSize>("1K");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageDataUrl: string; textContent: string | null } | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!editFile) {
      setEditPreview(null);
      return;
    }
    const url = URL.createObjectURL(editFile);
    setEditPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [editFile]);

  const handleGenerate = useCallback(async () => {
    if (mode === "generate" && !prompt.trim()) {
      toast.error("프롬프트를 입력해주세요.");
      promptRef.current?.focus();
      return;
    }
    if (mode === "edit" && !editFile) {
      toast.error("편집할 이미지를 선택해주세요.");
      return;
    }
    if (mode === "edit" && !prompt.trim()) {
      toast.error("편집 지시사항을 입력해주세요.");
      promptRef.current?.focus();
      return;
    }

    setGenerating(true);
    setResult(null);

    let actionResult: ActionResult<ImageGenerationResult>;
    if (mode === "generate") {
      actionResult = await generateImage({ prompt: prompt.trim(), model, aspectRatio, imageSize });
    } else {
      const base64 = await fileToBase64(editFile!).catch(() => null);
      if (!base64) {
        toast.error("이미지 변환에 실패했습니다.");
        setGenerating(false);
        return;
      }
      actionResult = await editImage({
        imageBase64: base64,
        mimeType: editFile!.type || "image/jpeg",
        instruction: prompt.trim(),
        model,
        aspectRatio,
        imageSize,
      });
    }

    setGenerating(false);

    if (!actionResult.ok) {
      toast.error(actionResult.message);
      return;
    }

    setResult(actionResult.data);

    const newItem: GeneratedImage = {
      id: crypto.randomUUID(),
      prompt: prompt.trim(),
      imageDataUrl: actionResult.data.imageDataUrl,
      textContent: actionResult.data.textContent,
      model,
      aspectRatio,
      imageSize,
      mode,
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });

    toast.success("이미지가 생성되었습니다!");
  }, [mode, prompt, model, aspectRatio, imageSize, editFile]);

  const handleEditFromResult = useCallback(() => {
    if (!result) return;
    fetch(result.imageDataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], "generated-image.png", { type: "image/png" });
        setEditFile(file);
        setMode("edit");
        setPrompt("");
        promptRef.current?.focus();
      })
      .catch(() => toast.error("이미지를 편집 모드로 전환할 수 없습니다."));
  }, [result]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadImage(result.imageDataUrl, `ai-image-${timestamp}.png`);
    toast.success("이미지를 다운로드했습니다.");
  }, [result]);

  const handleCopyPrompt = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("프롬프트가 복사되었습니다.");
  }, []);

  const handleHistorySelect = useCallback((item: GeneratedImage) => {
    setResult({ imageDataUrl: item.imageDataUrl, textContent: item.textContent });
    setPrompt(item.prompt);
    setModel(item.model);
    setAspectRatio(item.aspectRatio);
    setImageSize(item.imageSize);
    setMode(item.mode);
  }, []);

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    if (!window.confirm("모든 생성 기록을 삭제할까요?")) return;
    setHistory([]);
    saveHistory([]);
    toast.success("기록이 삭제되었습니다.");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        setEditFile(file);
        if (mode !== "edit") setMode("edit");
      }
    },
    [mode],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card className="border-[#2a2a2a] bg-[#141414] p-1.5">
            <div className="flex">
              <button
                type="button"
                onClick={() => setMode("generate")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors ${
                  mode === "generate" ? "bg-[#e5e5e5] text-[#0a0a0a]" : "text-[#9a9a9a] hover:text-[#d4d4d4]"
                }`}
              >
                <Sparkles className="h-4 w-4" /> 생성
              </button>
              <button
                type="button"
                onClick={() => setMode("edit")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-colors ${
                  mode === "edit" ? "bg-[#e5e5e5] text-[#0a0a0a]" : "text-[#9a9a9a] hover:text-[#d4d4d4]"
                }`}
              >
                <Paintbrush className="h-4 w-4" /> 편집
              </button>
            </div>
          </Card>

          <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
            <p className="text-xs font-medium tracking-wide text-[#9a9a9a] uppercase">모델</p>
            <div className="grid grid-cols-2 gap-2">
              {IMAGE_MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setModel(m.value)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left transition-colors ${
                    model === m.value
                      ? "border-[#e5e5e5] bg-[#1a1a1a] text-[#ffffff]"
                      : "border-[#2a2a2a] text-[#9a9a9a] hover:border-[#3a3a3a] hover:text-[#d4d4d4]"
                  }`}
                >
                  {m.value === "flash" ? (
                    <Zap className="h-4 w-4 shrink-0" />
                  ) : (
                    <Crown className="h-4 w-4 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[10px] text-[#9a9a9a]">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {mode === "edit" && (
            <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
              <p className="text-xs font-medium tracking-wide text-[#9a9a9a] uppercase">원본 이미지</p>
              <button
                type="button"
                className="relative w-full cursor-pointer rounded-md border-2 border-dashed border-[#3a3a3a] bg-[#0a0a0a] p-6 text-center transition-colors hover:border-[#e5e5e5]"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditFile(file);
                    e.target.value = "";
                  }}
                />
                {editPreview ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editPreview} alt="편집 원본" className="mx-auto max-h-40 rounded-md object-contain" />
                    <p className="truncate text-xs text-[#9a9a9a]">{editFile?.name}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFile(null);
                      }}
                    >
                      <X className="mr-1 h-3 w-3" /> 제거
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-[#9a9a9a]" />
                    <p className="text-sm text-[#9a9a9a]">이미지를 드래그하거나 클릭하여 선택</p>
                    <p className="text-[10px] text-[#9a9a9a]">PNG, JPG, WebP 지원</p>
                  </div>
                )}
              </button>
            </Card>
          )}

          <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
            <p className="text-xs font-medium tracking-wide text-[#9a9a9a] uppercase">
              {mode === "generate" ? "프롬프트" : "편집 지시사항"}
            </p>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] w-full resize-none rounded-md border border-[#2a2a2a] bg-[#0a0a0a] px-3 py-2.5 text-sm text-[#e5e5e5] outline-none transition-colors placeholder:text-[#9a9a9a] focus:border-[#3a3a3a]"
              placeholder={
                mode === "generate"
                  ? "생성할 이미지를 자세히 설명해주세요...\n\n예: 따뜻한 조명 아래 아늑한 카페에서 책을 읽는 고양이, 85mm 렌즈, 부드러운 보케"
                  : "이미지를 어떻게 수정할지 설명해주세요...\n\n예: 배경을 해질녘 해변으로 변경해주세요. 원본의 조명 톤을 유지하세요."
              }
            />
            <p className="text-[10px] text-[#9a9a9a]">⌘/Ctrl + Enter로 바로 생성</p>
          </Card>

          <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
            <p className="text-xs font-medium tracking-wide text-[#9a9a9a] uppercase">비율</p>
            <div className="grid grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((r) => (
                <AspectRatioButton
                  key={r.value}
                  ratio={r}
                  selected={aspectRatio === r.value}
                  onClick={() => setAspectRatio(r.value)}
                />
              ))}
            </div>
          </Card>

          <Card className="space-y-3 border-[#2a2a2a] bg-[#141414] p-4">
            <p className="text-xs font-medium tracking-wide text-[#9a9a9a] uppercase">해상도</p>
            <div className="flex gap-2">
              {IMAGE_SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setImageSize(s.value)}
                  className={`flex-1 rounded-md border px-3 py-2 text-center transition-colors ${
                    imageSize === s.value
                      ? "border-[#e5e5e5] bg-[#1a1a1a] text-[#ffffff]"
                      : "border-[#2a2a2a] text-[#9a9a9a] hover:border-[#3a3a3a] hover:text-[#d4d4d4]"
                  }`}
                >
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-[10px] text-[#9a9a9a]">{s.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Button className="w-full" onClick={() => void handleGenerate()} isLoading={generating} disabled={generating}>
            {!generating && <Sparkles className="mr-2 h-4 w-4" />}
            {generating ? "생성 중..." : mode === "generate" ? "이미지 생성" : "이미지 편집"}
          </Button>

          <div className="space-y-1.5 rounded-md border border-[#2a2a2a] bg-[#141414] px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#9a9a9a]">프롬프트 팁</p>
            <ul className="space-y-1 text-[11px] text-[#9a9a9a]">
              <li>• 장면을 서술적으로 묘사하세요</li>
              <li>• &quot;85mm 렌즈&quot;, &quot;골든 아워&quot; 같은 사진 용어 활용</li>
              <li>• 텍스트가 필요하면 정확한 문구와 폰트 스타일 명시</li>
              <li>• &quot;~하지 말고&quot;보다 &quot;~하게&quot;로 표현하세요</li>
              <li>• Flash는 빠르고, Pro는 더 정교합니다</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-[#2a2a2a] bg-[#141414] p-6">
            {generating ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#e5e5e5] border-r-transparent" />
                <p className="mt-4 text-sm text-[#9a9a9a]">AI가 이미지를 생성하고 있습니다...</p>
                <p className="mt-1 text-[10px] text-[#9a9a9a]">모델과 해상도에 따라 10~30초가 소요됩니다</p>
              </div>
            ) : result ? (
              <div className="space-y-4">
                <div className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.imageDataUrl}
                    alt="생성된 이미지"
                    className="w-full cursor-pointer rounded-md border border-[#2a2a2a]"
                    onClick={() => setFullscreenImage(result.imageDataUrl)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setFullscreenImage(result.imageDataUrl);
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 rounded-md bg-[#0a0a0a]/80 p-2 text-[#9a9a9a] opacity-0 transition-opacity hover:text-[#ffffff] group-hover:opacity-100"
                    onClick={() => setFullscreenImage(result.imageDataUrl)}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>

                {result.textContent && (
                  <div className="rounded-md border border-[#2a2a2a] bg-[#0a0a0a] p-3">
                    <p className="mb-1 text-xs text-[#9a9a9a]">AI 응답</p>
                    <p className="whitespace-pre-wrap text-sm text-[#d4d4d4]">{result.textContent}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="mr-1 h-3.5 w-3.5" /> 다운로드
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditFromResult}>
                    <Paintbrush className="mr-1 h-3.5 w-3.5" /> 이 이미지 편집
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void handleGenerate()}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> 재생성
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void handleCopyPrompt(prompt)}>
                    {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                    프롬프트 복사
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ImagePlus className="h-16 w-16 text-[#2a2a2a]" />
                <p className="mt-4 text-sm text-[#9a9a9a]">
                  {mode === "generate"
                    ? "프롬프트를 입력하고 이미지를 생성해보세요"
                    : "이미지를 업로드하고 편집 지시사항을 입력하세요"}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Badge tone="neutral">
                    <Zap className="mr-1 h-3 w-3" /> Flash: 빠르고 경제적
                  </Badge>
                  <Badge tone="neutral">
                    <Crown className="mr-1 h-3 w-3" /> Pro: 고품질 정교함
                  </Badge>
                </div>
              </div>
            )}
          </Card>

          {history.length > 0 && (
            <Card className="border-[#2a2a2a] bg-[#141414] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-[#9a9a9a]">
                  생성 기록 ({history.length})
                </p>
                <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                  <Trash2 className="mr-1 h-3 w-3" /> 전체 삭제
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {history.map((item) => (
                  <div key={item.id} className="group relative">
                    <button
                      type="button"
                      className="w-full overflow-hidden rounded-md border border-[#2a2a2a] transition-colors hover:border-[#e5e5e5]"
                      onClick={() => handleHistorySelect(item)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageDataUrl}
                        alt={item.prompt.slice(0, 50)}
                        className="aspect-square w-full object-cover"
                      />
                    </button>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-[#0a0a0a]/80 p-1 text-[#9a9a9a] opacity-0 transition-opacity hover:text-[#ff4d6d] group-hover:opacity-100"
                      onClick={() => handleDeleteHistoryItem(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="mt-1 flex items-center gap-1">
                      <Badge
                        tone={item.mode === "generate" ? "brand" : "warning"}
                        className="h-4 px-1 text-[8px]"
                      >
                        {item.mode === "generate" ? "생성" : "편집"}
                      </Badge>
                      <span className="truncate text-[8px] text-[#9a9a9a]">
                        {item.model === "flash" ? "Flash" : "Pro"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {fullscreenImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a]/95 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setFullscreenImage(null)}
            aria-label="닫기"
          />
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-md bg-[#1a1a1a] p-2 text-[#9a9a9a] hover:text-[#ffffff]"
            onClick={() => setFullscreenImage(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullscreenImage}
            alt="전체 화면"
            className="relative z-10 max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />
        </div>
      )}
    </>
  );
}
