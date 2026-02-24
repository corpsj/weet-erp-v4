import { AuthShell } from "@/components/shared/auth-shell";
import { SignupForm } from "@/components/shared/signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="초대코드 회원가입"
      subtitle="관리자가 발급한 초대코드를 입력하면 계정을 생성할 수 있습니다."
    >
      <SignupForm />
    </AuthShell>
  );
}
