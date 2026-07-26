import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@repo/types';

/**
 * The one exception type feature code throws. Carries a stable machine
 * `code` (the contract — clients switch on it) plus optional structured
 * `details`. The global filter renders it into the uniform error envelope
 * (`errorEnvelopeSchema`). Never throw raw `HttpException` for domain errors —
 * use this so the `code` is always present.
 */
export class ApiError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static notFound(message = 'Not found', code: ApiErrorCode = 'NOT_FOUND') {
    return new ApiError(HttpStatus.NOT_FOUND, code, message);
  }

  static unauthenticated(message = 'Authentication required') {
    return new ApiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Forbidden', code: ApiErrorCode = 'FORBIDDEN') {
    return new ApiError(HttpStatus.FORBIDDEN, code, message);
  }

  static conflict(code: ApiErrorCode, message: string, details?: unknown) {
    return new ApiError(HttpStatus.CONFLICT, code, message, details);
  }

  static validation(message = 'Validation failed', details?: unknown) {
    return new ApiError(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message, details);
  }
}
