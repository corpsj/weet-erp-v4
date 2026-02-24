import { ModuleShell } from "@/components/layout/module-shell";
import { MemosWorkspace } from "@/components/modules/memos/memos-workspace";

export default function MemosPage() {
  return (
    <ModuleShell
      title="메모"
      description="폴더, 첨부, 자동 저장을 포함하는 문서 협업 모듈의 시작점입니다."
      breadcrumb={[{ label: "워크스페이스" }, { label: "메모" }]}
    >
      <MemosWorkspace />
    </ModuleShell>
  );
}
