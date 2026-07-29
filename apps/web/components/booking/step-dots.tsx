import { cn } from '@/lib/utils';

interface StepDotsProps {
  /** Total number of steps */
  total: number;
  /** Current active step (1-indexed) */
  current: number;
  className?: string;
}

/**
 * Step progress indicator (Design `stepdots` component).
 * Active dots render as wider pill shapes with accent color;
 * inactive dots are small circles with muted line color.
 */
export function StepDots({ total, current, className }: StepDotsProps) {
  return (
    <div className={cn('flex items-center gap-[5px]', className)}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i < current;
        return (
          <i
            key={i}
            className={cn(
              'block h-1.5 rounded-full transition-all',
              isActive
                ? 'w-[18px] bg-accent'
                : 'w-1.5 bg-line-300',
            )}
          />
        );
      })}
    </div>
  );
}
