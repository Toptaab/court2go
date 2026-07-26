import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorCode, ErrorEnvelope } from '@repo/types';
import { ApiError } from './api-error';

/**
 * Global exception filter — the SINGLE place non-2xx responses are shaped
 * (ARCHITECTURE §3.4). EVERY error leaves as `errorEnvelopeSchema`:
 * `{ error: { code, message, details? } }`. Unknown errors are logged in full
 * and returned as an opaque 500 (never leak internals to the client).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ApiErrorCode = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ApiError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      // Framework-thrown (e.g. 404 no route, payload too large). Map status →
      // a sensible code so the envelope stays uniform.
      status = exception.getStatus();
      code = statusToCode(status);
      const resp = exception.getResponse();
      message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message?.toString() ?? exception.message);
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
    }

    const body: ErrorEnvelope = {
      error: { code, message, ...(details === undefined ? {} : { details }) },
    };
    res.status(status).json(body);
  }
}

function statusToCode(status: number): ApiErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'INVALID_STATE_TRANSITION';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'SLIP_UPLOAD_INVALID';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'INTERNAL_ERROR';
  }
}
