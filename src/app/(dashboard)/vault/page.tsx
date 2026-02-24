import { ModuleShell } from "@/components/layout/module-shell";
import { VaultWorkspace } from "@/components/modules/vault/vault-workspace";

export default function VaultPage() {
  return (
    <ModuleShell
      title="계정 공유"
      description="AES-256-GCM 암호화 기반 Vault 저장소의 기본 화면입니다."
      breadcrumb={[{ label: "보안" }, { label: "계정 공유" }]}
    >
      <VaultWorkspace />
    </ModuleShell>
  );
}
