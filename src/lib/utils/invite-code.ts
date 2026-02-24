import crypto from "node:crypto";

export function hashInviteCode(code: string) {
  const pepper = process.env.SIGNUP_CODE_PEPPER?.trim();

  if (!pepper) {
    throw new Error("SIGNUP_CODE_PEPPER 환경변수가 필요합니다.");
  }

  return crypto
    .createHash("sha256")
    .update(`${pepper}:${code.trim()}`)
    .digest("hex");
}
