"use client";

import type { ApiErrorShape, ApiSuccess } from "@/types/api";

export class ClientApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function fetchApi<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiErrorShape;
    throw new ClientApiError(
      response.status,
      error.code ?? "INTERNAL_ERROR",
      error.message ?? "요청에 실패했습니다.",
    );
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}
