import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(2, "아이디를 입력해주세요."),
  password: z.string().min(6, "비밀번호를 입력해주세요."),
  rememberUsername: z.boolean().optional(),
});

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "아이디를 입력해주세요.")
    .max(30, "아이디는 30자 이하로 입력해주세요.")
    .regex(/^[a-zA-Z0-9._-]+$/, "아이디는 영문, 숫자, ., _, - 만 사용할 수 있습니다."),
  displayName: z.string().trim().min(1, "이름을 입력해주세요.").max(40, "이름이 너무 깁니다."),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 최대 72자까지 가능합니다."),
  inviteCode: z.string().trim().min(6, "초대코드를 입력해주세요."),
});
