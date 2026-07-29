"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    label: "Home",
    href: "/",
    matchPrefix: ["/news"],
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-accent" : "text-ink-500"}
      >
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: "Booking",
    href: "/branches",
    matchPrefix: ["/branches", "/courts", "/booking"],
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-accent" : "text-ink-500"}
      >
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
  {
    label: "Account",
    href: "/account",
    matchPrefix: ["/account","/login"],
    icon: (active: boolean) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "text-accent" : "text-ink-500"}
      >
        <circle cx="12" cy="8" r="5" />
        <path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    ),
  },
];

/** Paths where the tab bar should be hidden (payment/login flow only) */
const HIDDEN_PREFIXES = ["/booking/payment", "/booking/login", "/booking/otp"];

export function BottomTabBar() {
  const pathname = usePathname();

  // Hide only during payment and login screens
  const shouldHide = HIDDEN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  if (shouldHide) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md border-t border-line-100 bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href ||
          tab.matchPrefix.some((prefix) => pathname.startsWith(prefix));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 ${
              isActive ? "text-accent" : "text-ink-500"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.icon(isActive)}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
