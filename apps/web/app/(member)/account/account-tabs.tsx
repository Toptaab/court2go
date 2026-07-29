'use client';

import { useState } from 'react';
import type { Me } from '@repo/types';
import { ProfileView } from './profile-view';
import { MyBookingsTab } from './my-bookings-tab';
import { cn } from '@/lib/utils';

type Tab = 'bookings' | 'profile';

interface AccountTabsProps {
  initialMe: Me;
}

/**
 * Account section with tab navigation (Design `acctabs` component).
 * Two tabs: "My Bookings" (M14) and "Profile" (M19).
 *
 * Visual spec from design:
 * - Full-width flex row, border-bottom
 * - Active tab: accent text + accent underline bar (2px, 60% width centered)
 * - Inactive: ink-500 text
 * - 13.5px font, semibold, 13px vertical padding
 */
export function AccountTabs({ initialMe }: AccountTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('bookings');

  return (
    <div className="flex flex-col gap-0">
      {/* Tab bar (Design acctabs) */}
      <div className="flex border-b border-line-100 bg-surface">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={cn(
            'relative flex-1 py-3 text-[13.5px] font-semibold transition-colors',
            activeTab === 'bookings' ? 'text-accent' : 'text-ink-500',
          )}
        >
          My Bookings
          {activeTab === 'bookings' && (
            <span className="absolute bottom-[-1px] left-[20%] right-[20%] h-0.5 rounded-full bg-accent" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={cn(
            'relative flex-1 py-3 text-[13.5px] font-semibold transition-colors',
            activeTab === 'profile' ? 'text-accent' : 'text-ink-500',
          )}
        >
          Profile
          {activeTab === 'profile' && (
            <span className="absolute bottom-[-1px] left-[20%] right-[20%] h-0.5 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="pt-4">
        {activeTab === 'bookings' && <MyBookingsTab />}
        {activeTab === 'profile' && <ProfileView initialMe={initialMe} />}
      </div>
    </div>
  );
}
