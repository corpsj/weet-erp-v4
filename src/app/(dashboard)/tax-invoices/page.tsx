import { ModuleShell } from "@/components/layout/module-shell";
import { TaxInvoicesWorkspace } from "@/components/modules/tax-invoices/tax-invoices-workspace";

export default function TaxInvoicesPage() {
  return (
    <ModuleShell
      title="세금계산서"
      description="매출/매입 분류와 VAT 계산 흐름을 담을 화면 기반입니다."
      breadcrumb={[{ label: "재무/회계" }, { label: "세금계산서" }]}
    >
      <TaxInvoicesWorkspace />
    </ModuleShell>
  );
}
