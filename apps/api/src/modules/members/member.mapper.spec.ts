import type { Member } from '../../generated/prisma/client';
import { mapMemberToMe } from './member.mapper';

/**
 * Unit coverage for the Prisma `Member` → `Me` DTO boundary mapper
 * (ARCHITECTURE §3.1). The two derived booleans are the interesting part:
 * `lineBound` reflects the OA-follow timestamp (`lineBoundAt`), while
 * `hasLineLogin` reflects whether the account has a LINE identity at all
 * (`lineUserId`) — they are independent and must not be conflated.
 */
const MEMBER_ID = '00000000-0000-4000-8000-000000000001';

const baseMember = (over: Partial<Member> = {}): Member =>
  ({
    id: MEMBER_ID,
    tenantId: 'tenant-1',
    phone: '0812345678',
    phoneVerified: true,
    name: 'Somchai',
    emergencyContact: '0899999999',
    sex: 'MALE',
    lineUserId: null,
    lineBoundAt: null,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    updatedAt: new Date('2026-01-02T03:04:05.000Z'),
    ...over,
  }) as Member;

describe('mapMemberToMe', () => {
  it('maps a fully-populated phone member', () => {
    const me = mapMemberToMe(baseMember());
    expect(me).toEqual({
      id: MEMBER_ID,
      phone: '0812345678',
      phoneVerified: true,
      name: 'Somchai',
      emergencyContact: '0899999999',
      sex: 'MALE',
      lineBound: false,
      hasLineLogin: false,
      createdAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('serializes createdAt as an ISO-8601 string', () => {
    const me = mapMemberToMe(baseMember());
    expect(me.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('sets hasLineLogin=true when a lineUserId is present', () => {
    const me = mapMemberToMe(baseMember({ lineUserId: 'linestub_abc' }));
    expect(me.hasLineLogin).toBe(true);
  });

  it('sets lineBound=true only when lineBoundAt is a timestamp', () => {
    expect(mapMemberToMe(baseMember({ lineBoundAt: new Date() })).lineBound).toBe(true);
    expect(mapMemberToMe(baseMember({ lineBoundAt: null })).lineBound).toBe(false);
  });

  it('treats lineBound and hasLineLogin as independent flags', () => {
    // A LINE-login account that has not yet followed the OA.
    const me = mapMemberToMe(baseMember({ lineUserId: 'linestub_abc', lineBoundAt: null }));
    expect(me.hasLineLogin).toBe(true);
    expect(me.lineBound).toBe(false);
  });

  it('passes through null profile fields for a fresh LINE-only member', () => {
    const me = mapMemberToMe(
      baseMember({
        phone: null,
        phoneVerified: false,
        name: null,
        emergencyContact: null,
        sex: null,
        lineUserId: 'linestub_abc',
      }),
    );
    expect(me.phone).toBeNull();
    expect(me.phoneVerified).toBe(false);
    expect(me.name).toBeNull();
    expect(me.sex).toBeNull();
  });
});
