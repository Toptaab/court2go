/**
 * Placeholder root route — exercises `(public)/layout.tsx` + tokens for
 * `next build`. Real content (news feed, M1) lands in M10.3.
 */
export default function PublicHomePage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-disp text-xl font-semibold text-fg">court2go</h1>
      <p className="text-sm text-fg-muted">
        จองสนามกีฬาใกล้บ้านคุณ / Book courts near you.
      </p>
    </div>
  );
}
