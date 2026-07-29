export function AppBar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md items-center gap-3 border-b border-line-100 bg-surface px-4 py-3">
      {/* Logo mark */}
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="text-white"
        >
          <circle cx="8" cy="8" r="3" fill="currentColor" />
        </svg>
      </div>
      {/* Venue name */}
      <span className="text-base font-extrabold text-ink-900">
        Baseline Club
      </span>
    </header>
  );
}
