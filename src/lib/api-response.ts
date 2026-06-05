import { NextResponse } from 'next/server';

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T) {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data });
}

export function failure(message: string, status = 400, code?: string) {
  return NextResponse.json<ApiFailure>({ ok: false, error: { message, code } }, { status });
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error';
}
