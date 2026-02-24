"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchApi } from "@/lib/api/client";

export function SignupForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsPending(true);

    try {
      await fetchApi("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          username,
          displayName,
          password,
          inviteCode,
        }),
      });
      toast.success("회원가입이 완료되었습니다. 로그인 후 이용해주세요.");
      router.push("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "회원가입에 실패했습니다.";
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="signup-username">
          아이디
        </label>
        <Input
          id="signup-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="영문/숫자 조합"
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="signup-displayName">
          이름
        </label>
        <Input
          id="signup-displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="예: 김위트"
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="signup-password">
          비밀번호
        </label>
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm text-[var(--color-ink-muted)]" htmlFor="signup-code">
          초대코드
        </label>
        <Input
          id="signup-code"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder="관리자가 발급한 코드"
          required
        />
      </div>

      <Button className="w-full" disabled={isPending}>
        {isPending ? "가입 처리 중..." : "회원가입"}
      </Button>

      <p className="text-center text-sm text-[var(--color-ink-muted)]">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-brand)] hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
