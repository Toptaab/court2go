import { meSchema, type Me } from '@repo/types';
import type { Member } from '../../generated/prisma/client';

/**
 * Prisma `Member` row → the `Me` contract DTO (ARCHITECTURE §3.1: map at the
 * boundary, never leak Prisma types across the wire). Shared by
 * `AuthMemberService` (session-establishment responses) and `MeController`
 * (profile GET/PATCH) so there is exactly one mapping.
 *
 * Parses through `meSchema` before returning — fail loudly on contract drift
 * rather than silently shipping a malformed shape (mirrors
 * `availability`-style services elsewhere in this app).
 */
export function mapMemberToMe(member: Member): Me {
  return meSchema.parse({
    id: member.id,
    phone: member.phone,
    phoneVerified: member.phoneVerified,
    name: member.name,
    emergencyContact: member.emergencyContact,
    sex: member.sex,
    lineBound: member.lineBoundAt != null,
    hasLineLogin: member.lineUserId != null,
    createdAt: member.createdAt.toISOString(),
  });
}
