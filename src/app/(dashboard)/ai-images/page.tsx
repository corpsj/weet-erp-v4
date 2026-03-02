import { ModuleShell } from "@/components/layout/module-shell";
import { AiImagesWorkspace } from "@/components/modules/ai-images/ai-images-workspace";

export default function AiImagesPage() {
  return (
    <ModuleShell
      title="AI 이미지"
      description="Gemini AI를 활용한 이미지 생성 및 편집 도구입니다."
      breadcrumb={[{ label: "도구" }, { label: "AI 이미지" }]}
    >
      <AiImagesWorkspace />
    </ModuleShell>
  );
}
