'use client';

import { useRef, useCallback, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  /** Number of OTP digits (default 6) */
  length?: number;
  /** Called with the full OTP string when all cells are filled */
  onComplete?: (code: string) => void;
  /** Called on every change with current value */
  onChange?: (code: string) => void;
  /** Show error state on all cells */
  error?: boolean;
  /** Disable all cells */
  disabled?: boolean;
  className?: string;
}

/**
 * OTP digit-cell input (Design `otpcells`/`otpc` component).
 * Renders individual cells for each digit with auto-advance on input
 * and backspace-to-previous behavior. Supports paste of full code.
 *
 * Visual spec from design:
 * - Each cell: 44px wide, 54px tall, rounded-md border
 * - Filled: accent border color
 * - Focused (cursor): accent border + accent ring shadow
 * - Error: danger border + danger text color
 * - Font: mono, 24px, bold
 */
export function OtpInput({
  length = 6,
  onComplete,
  onChange,
  error = false,
  disabled = false,
  className,
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusCell = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
      }
    },
    [length],
  );

  const updateValues = useCallback(
    (newValues: string[]) => {
      setValues(newValues);
      const code = newValues.join('');
      onChange?.(code);
      if (code.length === length && newValues.every((v) => v !== '')) {
        onComplete?.(code);
      }
    },
    [length, onChange, onComplete],
  );

  const handleInput = useCallback(
    (index: number, digit: string) => {
      if (!/^\d$/.test(digit)) return;
      const newValues = [...values];
      newValues[index] = digit;
      updateValues(newValues);
      focusCell(index + 1);
    },
    [values, updateValues, focusCell],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const newValues = [...values];
        if (newValues[index]) {
          newValues[index] = '';
          updateValues(newValues);
        } else if (index > 0) {
          newValues[index - 1] = '';
          updateValues(newValues);
          focusCell(index - 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusCell(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusCell(index + 1);
      }
    },
    [values, updateValues, focusCell],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
      if (!pasted) return;
      const newValues = [...values];
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i];
      }
      updateValues(newValues);
      focusCell(Math.min(pasted.length, length - 1));
    },
    [values, length, updateValues, focusCell],
  );

  return (
    <div className={cn('flex items-center justify-center gap-[9px]', className)}>
      {Array.from({ length }).map((_, i) => {
        const filled = values[i] !== '';
        return (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={values[i]}
            disabled={disabled}
            autoComplete="one-time-code"
            className={cn(
              'flex h-[54px] w-[44px] items-center justify-center rounded-md border-[1.5px] bg-surface text-center font-mono text-2xl font-bold text-fg outline-none transition-colors',
              error
                ? 'border-status-danger text-status-danger'
                : filled
                  ? 'border-accent'
                  : 'border-line-100',
              'focus:border-accent focus:shadow-[0_0_0_3px_rgba(12,140,106,0.25)]',
              disabled && 'opacity-50',
            )}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d$/.test(val)) {
                handleInput(i, val);
              } else if (val === '') {
                // Handled by keydown
              }
            }}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
          />
        );
      })}
    </div>
  );
}
