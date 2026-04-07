/**
 * apiError.ts — 통일된 API 에러 클래스
 *
 * 모든 라우트에서 일관된 에러 응답 형식을 위해 사용:
 *   throw new ApiError(400, '잘못된 요청입니다', 'INVALID_INPUT')
 *
 * 글로벌 에러 핸들러(app.ts)가 이 클래스를 감지해서
 * { error: string, code: string } 형식으로 응답합니다.
 */

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    // V8 스택 트레이스 캡처
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  toJSON(): { error: string; code: string } {
    return { error: this.message, code: this.code };
  }
}

// ── 공통 에러 팩토리 ──────────────────────────────────────────────

export const Errors = {
  /** 400 Bad Request */
  badRequest: (message = '잘못된 요청입니다', code = 'BAD_REQUEST') =>
    new ApiError(400, message, code),

  /** 401 Unauthorized */
  unauthorized: (message = '인증이 필요합니다', code = 'UNAUTHORIZED') =>
    new ApiError(401, message, code),

  /** 403 Forbidden */
  forbidden: (message = '권한이 없습니다', code = 'FORBIDDEN') =>
    new ApiError(403, message, code),

  /** 404 Not Found */
  notFound: (resource = '리소스', code = 'NOT_FOUND') =>
    new ApiError(404, `${resource}를 찾을 수 없습니다`, code),

  /** 409 Conflict */
  conflict: (message = '이미 존재합니다', code = 'CONFLICT') =>
    new ApiError(409, message, code),

  /** 422 Unprocessable Entity */
  validation: (message = '입력값이 올바르지 않습니다', code = 'VALIDATION_ERROR') =>
    new ApiError(422, message, code),

  /** 500 Internal Server Error */
  internal: (message = '서버 오류가 발생했습니다', code = 'INTERNAL_ERROR') =>
    new ApiError(500, message, code),
} as const;
