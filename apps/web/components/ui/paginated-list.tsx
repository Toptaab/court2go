'use client';

import type { ReactNode } from 'react';
import type { Paginated } from '@repo/types';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Prev / page-indicator / Next row shared by every paginated list.
 * Renders nothing on a single first page. Use standalone under tables;
 * card lists get it for free via <PaginatedList>.
 */
export function Pagination({ page, total, pageSize, hasNextPage, onPageChange, className }: PaginationProps) {
  if (!hasNextPage && page <= 1) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={cn('flex items-center justify-between gap-2 pt-2', className)}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        ก่อนหน้า / Prev
      </Button>
      <span className="font-score text-xs text-fg-muted">
        {page} / {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
        ถัดไป / Next
      </Button>
    </div>
  );
}

/**
 * One layout for every list in the app: a single-column stack that fills
 * its page container at every breakpoint. Intentionally not overridable —
 * every list page (paginated or not) looks the same.
 */
const LIST_LAYOUT = 'flex flex-col gap-3';

interface ListStateProps<T> {
  items: T[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  renderItem: (item: T, index: number) => ReactNode;
  keyOf: (item: T) => string;
  /** Bilingual message when the data loads but has no items. */
  emptyMessage: string;
  /** Optional richer empty state; wins over emptyMessage when provided. */
  empty?: ReactNode;
  errorMessage?: string;
  skeletonCount?: number;
  skeletonClassName?: string;
}

/**
 * The shared visual: loading skeletons, error, empty state, then the item
 * stack. Both <SimpleList> (plain array, no pager) and <PaginatedList>
 * (page envelope + pager) render through this so every list in the app —
 * paginated or not — looks identical.
 */
function ListState<T>({
  items,
  isLoading,
  isError = false,
  renderItem,
  keyOf,
  emptyMessage,
  empty,
  errorMessage = 'เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load.',
  skeletonCount = 5,
  skeletonClassName = 'h-16',
}: ListStateProps<T>) {
  return (
    <>
      {isLoading && (
        <div className={LIST_LAYOUT}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className={cn('animate-pulse rounded-card bg-surface-2', skeletonClassName)} />
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-status-danger">{errorMessage}</p>}

      {items && items.length === 0 && (empty ?? <EmptyState title={emptyMessage} />)}

      {items && items.length > 0 && (
        <div className={LIST_LAYOUT}>
          {items.map((item, i) => (
            <div key={keyOf(item)}>{renderItem(item, i)}</div>
          ))}
        </div>
      )}
    </>
  );
}

interface SimpleListProps<T> extends ListStateProps<T> {
  className?: string;
}

/**
 * Shared list shell for endpoints that return a plain array (no
 * pagination) — Branches, Sports, Courts, Promotions. Same loading/
 * error/empty/item visual as <PaginatedList>, just no pager.
 */
export function SimpleList<T>({ className, ...rest }: SimpleListProps<T>) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ListState {...rest} />
    </div>
  );
}

interface PaginatedListProps<T> extends Omit<ListStateProps<T>, 'items'> {
  data: Paginated<T> | undefined;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Shared paginated list shell: loading skeletons, error, empty state,
 * items container, and Prev/Next controls in one component. Every
 * card-style list page (members, payments, news, my-bookings, …)
 * renders through this instead of hand-rolling the four states.
 */
export function PaginatedList<T>({ data, page, onPageChange, className, ...rest }: PaginatedListProps<T>) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <ListState items={data?.items} {...rest} />

      {data && (
        <Pagination
          page={page}
          total={data.total}
          pageSize={data.pageSize}
          hasNextPage={data.hasNextPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export interface DataTableColumn<T> {
  header: string;
  cell: (item: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface TableStateProps<T> {
  items: T[] | undefined;
  isLoading: boolean;
  isError?: boolean;
  columns: DataTableColumn<T>[];
  keyOf: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage: string;
  errorMessage?: string;
  skeletonCount?: number;
  skeletonClassName?: string;
  /** Tailwind min-width class for the table, e.g. "min-w-[860px]". */
  minWidth?: string;
}

/**
 * The admin-table visual (Design D2 / Bookings table): pulse-bar skeleton
 * while loading, plain centered text on error/empty, then a bordered
 * `overflow-x-auto` table with mono uppercase headers and hoverable rows.
 * Same shell every admin list table renders through — Bookings,
 * Cancellations, Branches, Sports, Courts, Promotions, News, Members.
 */
function TableState<T>({
  items,
  isLoading,
  isError = false,
  columns,
  keyOf,
  onRowClick,
  emptyMessage,
  errorMessage = 'เกิดข้อผิดพลาดในการโหลดข้อมูล / Failed to load.',
  skeletonCount = 6,
  skeletonClassName = 'h-12',
  minWidth = 'min-w-[720px]',
}: TableStateProps<T>) {
  return (
    <>
      {isLoading && (
        <div className={LIST_LAYOUT}>
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className={cn('animate-pulse rounded-card bg-surface-2', skeletonClassName)} />
          ))}
        </div>
      )}

      {isError && <p className="text-sm text-status-danger">{errorMessage}</p>}

      {items && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-muted">{emptyMessage}</p>
      )}

      {items && items.length > 0 && (
        <div className="overflow-hidden overflow-x-auto rounded-card border border-line-100">
          <table className={cn('w-full border-collapse text-sm', minWidth)}>
            <thead>
              <tr className="border-b border-line-100">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      'px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-fg-muted',
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-100">
              {items.map((item) => (
                <tr
                  key={keyOf(item)}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={cn('transition-colors hover:bg-surface-2', onRowClick && 'cursor-pointer')}
                >
                  {columns.map((col, i) => (
                    <td key={i} className={cn('px-3 py-2.5', col.cellClassName)}>
                      {col.cell(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface SimpleTableProps<T> extends TableStateProps<T> {
  className?: string;
}

/** Table-shell version of <SimpleList> for plain-array (non-paginated) endpoints. */
export function SimpleTable<T>({ className, ...rest }: SimpleTableProps<T>) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <TableState {...rest} />
    </div>
  );
}

interface PaginatedTableProps<T> extends Omit<TableStateProps<T>, 'items'> {
  data: Paginated<T> | undefined;
  page: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Table-shell version of <PaginatedList> for `Paginated<T>` endpoints. */
export function PaginatedTable<T>({ data, page, onPageChange, className, ...rest }: PaginatedTableProps<T>) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <TableState items={data?.items} {...rest} />

      {data && (
        <Pagination
          page={page}
          total={data.total}
          pageSize={data.pageSize}
          hasNextPage={data.hasNextPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
