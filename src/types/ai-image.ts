export type ImageModel = "flash" | "pro";
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:2" | "2:3" | "4:5" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";

export const IMAGE_MODELS: {
  value: ImageModel;
  label: string;
  description: string;
  modelId: string;
}[] = [
  {
    value: "flash",
    label: "Flash",
    description: "빠른 생성, 합리적 비용",
    modelId: "google/gemini-3.1-flash-image-preview",
  },
  {
    value: "pro",
    label: "Pro",
    description: "고품질, 정교한 디테일",
    modelId: "google/gemini-3-pro-image-preview",
  },
];

export const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "21:9", label: "21:9" },
];

export const IMAGE_SIZES: { value: ImageSize; label: string; description: string }[] = [
  { value: "1K", label: "1K", description: "1024px" },
  { value: "2K", label: "2K", description: "2048px" },
  { value: "4K", label: "4K", description: "4096px" },
];

export type GenerateImageInput = {
  prompt: string;
  model: ImageModel;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
};

export type EditImageInput = {
  imageBase64: string;
  mimeType: string;
  instruction: string;
  model: ImageModel;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
};

export type ImageGenerationResult = {
  imageDataUrl: string;
  textContent: string | null;
};

export type GeneratedImage = {
  id: string;
  prompt: string;
  imageDataUrl: string;
  textContent: string | null;
  model: ImageModel;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  mode: "generate" | "edit";
  createdAt: string;
};
