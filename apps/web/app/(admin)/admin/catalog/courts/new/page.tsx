import { Suspense } from 'react';
import { NewCourtContent } from './new-court-content';

/**
 * Create-Court page wrapper — Next.js requires `useSearchParams` (used here
 * to read the optional `?branchId=` pre-select) to be inside a Suspense
 * boundary for static generation compatibility (same pattern as
 * `(member)/login/otp/page.tsx`).
 */
export default function NewCourtPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-surface-2" />}>
      <NewCourtContent />
    </Suspense>
  );
}
