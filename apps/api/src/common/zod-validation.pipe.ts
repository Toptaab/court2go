import { PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { ApiError } from './api-error';
import type { ValidationDetail } from '@repo/types';

/**
 * Validates a request payload (body/query/param) against a zod schema from
 * `@repo/types` — the SAME schema the web app validates with (ARCHITECTURE
 * §3.2, contract single-source). On failure throws a `VALIDATION_ERROR`
 * `ApiError` carrying flattened field/form errors. Coercion in the schema
 * (e.g. `paginationQuerySchema`) means raw query strings parse cleanly.
 *
 * Usage: `@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery`.
 */
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const flat = result.error.flatten();
      const details: ValidationDetail = {
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
        formErrors: flat.formErrors,
      };
      throw ApiError.validation('Request validation failed', details);
    }
    return result.data;
  }
}
