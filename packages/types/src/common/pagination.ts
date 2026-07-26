import { z } from 'zod';

/**
 * Page-based pagination query. Reused by every list endpoint. `page` is 1-based.
 * Query params arrive as strings; coerce so both zodResolver (web) and the
 * NestJS ValidationPipe accept raw query strings.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Generic paginated envelope. Use `paginated(itemSchema)` to build a concrete one. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    hasNextPage: z.boolean(),
  });

/** Standard sort direction for list endpoints that support ordering. */
export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;
