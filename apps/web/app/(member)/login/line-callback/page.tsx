import { Suspense } from 'react';
import { LineCallbackContent } from './line-callback-content';

/**
 * LINE callback page wrapper — useSearchParams requires Suspense boundary.
 */
export default function LineCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 pt-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-sm text-fg-muted">กำลังเข้าสู่ระบบ... / Signing in...</p>
        </div>
      }
    >
      <LineCallbackContent />
    </Suspense>
  );
}
