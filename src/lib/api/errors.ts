import { NextResponse } from "next/server";
import type { ApiErrorCode, ApiErrorShape } from "@/types/api";

const statusMap: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    const body: ApiErrorShape = {
      code: error.code,
      message: error.message,
      details: error.details,
    };
    return NextResponse.json(body, { status: statusMap[error.code] });
  }

  const body: ApiErrorShape = {
    code: "INTERNAL_ERROR",
    message: "예상치 못한 오류가 발생했습니다.",
  };
  return NextResponse.json(body, { status: 500 });
}

export function ok<T>(data: T) {
  return NextResponse.json({ data });
}
