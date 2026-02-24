import { ModuleShell } from "@/components/layout/module-shell";
import { BankTransactionsWorkspace } from "@/components/modules/bank-transactions/bank-transactions-workspace";

export default function BankTransactionsPage() {
  return (
    <ModuleShell
      title="입출금"
      description="현금 흐름 기록과 요약 지표를 위한 데이터 레이어를 준비했습니다."
      breadcrumb={[{ label: "재무/회계" }, { label: "입출금" }]}
    >
      <BankTransactionsWorkspace />
    </ModuleShell>
  );
}
