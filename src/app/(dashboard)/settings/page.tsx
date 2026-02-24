import { ModuleShell } from "@/components/layout/module-shell";
import { SettingsWorkspace } from "@/components/modules/settings/settings-workspace";

export default function SettingsPage() {
  return (
    <ModuleShell
      title="설정"
      description="사용자, 초대코드, AI 모델 설정을 관리하는 관리자 중심 모듈입니다."
      breadcrumb={[{ label: "시스템" }, { label: "설정" }]}
    >
      <SettingsWorkspace />
    </ModuleShell>
  );
}
