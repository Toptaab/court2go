import { Suspense } from 'react';
import { OtpVerifyContent } from './otp-verify-content';

/**
 * OTP entry page wrapper — Next.js requires useSearchParams to be inside a
 * Suspense boundary for static generation compatibility.
 */
export default function OtpVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 pt-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <OtpVerifyContent />
    </Suspense>
  );
}
