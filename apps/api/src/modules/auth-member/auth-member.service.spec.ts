import type { Response } from 'express';
import type { Config, Member, OtpChallenge, ClientSession } from '../../generated/prisma/client';
import { ApiError } from '../../common/api-error';
import { runWithTenant } from '../../prisma/tenant-context';
import type { OtpSender } from '../../integrations/ports/otp-sender.port';
import type { LineClient } from '../../integrations/ports/line-client.port';
import type { MembersRepository } from '../members/members.repository';
import type { OtpChallengesRepository } from './otp-challenges.repository';
import type { ClientSessionsRepository } from './client-sessions.repository';
import type { ConfigRepository } from '../config/config.repository';
import { MEMBER_SESSION_COOKIE } from './member-session.guard';
import { AuthMemberService } from './auth-member.service';
import { hashOtpCode, signLineState } from './otp.util';

/**
 * Orchestration coverage for member auth (PRD Epic C2, ARCHITECTURE §3.3/§4).
 * The service is the seam where the OTP state machine, the LOGIN/BIND
 * branching, LINE-state verification and session minting all live, so it is
 * exercised here with fully-mocked repositories + integration adapters — the
 * repositories' own tenant/RLS behaviour is out of scope (covered elsewhere).
 */
const TENANT = 'tenant-1';

/** Valid-uuid member ids (contract `idSchema` is `z.string().uuid()`). */
const U = {
  base: '00000000-0000-4000-8000-000000000001',
  existing: '00000000-0000-4000-8000-000000000002',
  unverified: '00000000-0000-4000-8000-000000000003',
  line: '00000000-0000-4000-8000-000000000004',
  someoneElse: '00000000-0000-4000-8000-000000000005',
  ret: '00000000-0000-4000-8000-000000000006',
  newMember: '00000000-0000-4000-8000-000000000007',
  owner: '00000000-0000-4000-8000-000000000008',
  attacker: '00000000-0000-4000-8000-000000000009',
} as const;
const PHONE = '0812345678';

const config = (over: Partial<Config> = {}): Config =>
  ({
    otpExpiryMinutes: 5,
    otpResendCooldownSeconds: 60,
    otpMaxSendsPerHour: 5,
    otpMaxAttempts: 3,
    clientSessionDurationDays: 30,
  }) as Config;

const member = (over: Partial<Member> = {}): Member =>
  ({
    id: U.base,
    tenantId: TENANT,
    phone: PHONE,
    phoneVerified: true,
    name: null,
    emergencyContact: null,
    sex: null,
    lineUserId: null,
    lineBoundAt: null,
    isBlocked: false,
    blockedReason: null,
    blockedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  }) as Member;

const challenge = (over: Partial<OtpChallenge> = {}): OtpChallenge =>
  ({
    id: '00000000-0000-4000-8000-0000000000c1',
    tenantId: TENANT,
    phone: PHONE,
    purpose: 'LOGIN',
    memberId: null,
    codeHash: hashOtpCode('123456'),
    attempts: 0,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 5 * 60_000),
    createdAt: new Date(),
    ...over,
  }) as OtpChallenge;

const session = (over: Partial<ClientSession> = {}): ClientSession =>
  ({
    id: 'sess-1',
    tenantId: TENANT,
    memberId: U.base,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    revokedAt: null,
    lastSeenAt: null,
    createdAt: new Date(),
    ...over,
  }) as ClientSession;

function makeRes() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response & { cookie: jest.Mock; clearCookie: jest.Mock };
}

function build() {
  const members = {
    findByPhone: jest.fn(),
    findByLineUserId: jest.fn(),
    findById: jest.fn(),
    createWithVerifiedPhone: jest.fn(),
    createFromLineLogin: jest.fn(),
    bindVerifiedPhone: jest.fn(),
  } as unknown as jest.Mocked<MembersRepository>;

  const otpChallenges = {
    create: jest.fn(),
    findById: jest.fn(),
    incrementAttempts: jest.fn(),
    consume: jest.fn(),
    countRecentForPhone: jest.fn().mockResolvedValue(0),
    mostRecentForPhone: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<OtpChallengesRepository>;

  const clientSessions = {
    create: jest.fn().mockResolvedValue(session()),
    revoke: jest.fn(),
  } as unknown as jest.Mocked<ClientSessionsRepository>;

  const configRepo = {
    get: jest.fn().mockResolvedValue(config()),
  } as unknown as jest.Mocked<ConfigRepository>;

  const otpSender = { send: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OtpSender>;
  const lineClient = {
    buildAuthorizationUrl: jest.fn().mockReturnValue('https://line/authorize?x=1'),
    exchangeCode: jest.fn(),
  } as unknown as jest.Mocked<LineClient>;

  const service = new AuthMemberService(
    members,
    otpChallenges,
    clientSessions,
    configRepo,
    otpSender,
    lineClient,
  );

  return { service, members, otpChallenges, clientSessions, configRepo, otpSender, lineClient };
}

describe('AuthMemberService', () => {
  describe('requestOtp', () => {
    it('creates a challenge, sends the code, and returns devCode in non-prod', async () => {
      const { service, otpChallenges, otpSender } = build();
      otpChallenges.create.mockResolvedValue(challenge({ createdAt: new Date() }));

      const res = await service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null);

      expect(otpChallenges.create).toHaveBeenCalledTimes(1);
      expect(otpSender.send).toHaveBeenCalledWith('0812345678', expect.stringMatching(/^\d{6}$/), 'LOGIN');
      expect(res.devCode).toMatch(/^\d{6}$/);
      // The stored hash must match the code that was actually sent (never plaintext).
      const created = otpChallenges.create.mock.calls[0][0];
      expect(created.codeHash).toBe(hashOtpCode(res.devCode as string));
    });

    it('withholds devCode in production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const { service, otpChallenges } = build();
        otpChallenges.create.mockResolvedValue(challenge());
        const res = await service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null);
        expect(res.devCode).toBeNull();
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    it('rejects a BIND request with no active session (401)', async () => {
      const { service, otpChallenges } = build();
      await expect(
        service.requestOtp({ phone: '0812345678', purpose: 'BIND' } as any, null),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(otpChallenges.create).not.toHaveBeenCalled();
    });

    it('attaches memberId to the challenge for a BIND request', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.create.mockResolvedValue(challenge({ purpose: 'BIND', memberId: U.owner }));
      await service.requestOtp({ phone: '0812345678', purpose: 'BIND' } as any, U.owner);
      expect(otpChallenges.create.mock.calls[0][0]).toMatchObject({ purpose: 'BIND', memberId: U.owner });
    });

    it('rate-limits when inside the resend cooldown window (429)', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.mostRecentForPhone.mockResolvedValue(challenge({ createdAt: new Date(Date.now() - 10_000) }));
      await expect(
        service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null),
      ).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
      expect(otpChallenges.create).not.toHaveBeenCalled();
    });

    it('rate-limits when the rolling-hour send cap is reached (429)', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.countRecentForPhone.mockResolvedValue(5); // == otpMaxSendsPerHour
      await expect(
        service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null),
      ).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
    });

    it('allows a resend once the cooldown has elapsed', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.mostRecentForPhone.mockResolvedValue(challenge({ createdAt: new Date(Date.now() - 61_000) }));
      otpChallenges.create.mockResolvedValue(challenge());
      await expect(
        service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null),
      ).resolves.toBeDefined();
      expect(otpChallenges.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('verifyOtp — state machine', () => {
    it('404-style OTP_INVALID when the challenge does not exist', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(null);
      await expect(
        service.verifyOtp({ challengeId: 'nope', code: '123456' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
    });

    it('OTP_EXPIRED for an already-consumed challenge', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ consumedAt: new Date() }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
    });

    it('OTP_EXPIRED past expiresAt', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
    });

    it('OTP_MAX_ATTEMPTS once attempts hit the cap', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ attempts: 3 }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'OTP_MAX_ATTEMPTS' });
    });

    it('increments attempts and throws OTP_INVALID on a wrong code', async () => {
      const { service, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge());
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '000000' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'OTP_INVALID' });
      expect(otpChallenges.incrementAttempts).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000000c1');
      expect(otpChallenges.consume).not.toHaveBeenCalled();
    });

    it('consumes the challenge exactly once on a correct code', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge());
      members.findByPhone.mockResolvedValue(member());
      await service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null);
      expect(otpChallenges.consume).toHaveBeenCalledWith('00000000-0000-4000-8000-0000000000c1');
      expect(otpChallenges.incrementAttempts).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp — LOGIN branch', () => {
    it('creates a new verified member when the phone is unseen', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'LOGIN' }));
      members.findByPhone.mockResolvedValue(null);
      members.createWithVerifiedPhone.mockResolvedValue(member());
      const res = makeRes();

      const out = await service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, res, null);

      expect(members.createWithVerifiedPhone).toHaveBeenCalledWith('0812345678');
      expect(out.member.phoneVerified).toBe(true);
      expect(res.cookie).toHaveBeenCalledWith(MEMBER_SESSION_COOKIE, 'sess-1', expect.objectContaining({ httpOnly: true }));
    });

    it('returns the existing member without re-creating', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'LOGIN' }));
      members.findByPhone.mockResolvedValue(member({ id: U.existing }));
      const out = await service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null);
      expect(members.createWithVerifiedPhone).not.toHaveBeenCalled();
      expect(out.member.id).toBe(U.existing);
    });

    it('promotes an existing-but-unverified member to verified', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'LOGIN' }));
      members.findByPhone.mockResolvedValue(member({ id: U.unverified, phoneVerified: false }));
      members.bindVerifiedPhone.mockResolvedValue(member({ id: U.unverified, phoneVerified: true }));
      await service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null);
      expect(members.bindVerifiedPhone).toHaveBeenCalledWith(U.unverified, '0812345678');
    });

    it('refuses to mint a session for a blocked member (MEMBER_BLOCKED 403)', async () => {
      const { service, members, otpChallenges, clientSessions } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'LOGIN' }));
      members.findByPhone.mockResolvedValue(member({ id: U.existing, isBlocked: true }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), null),
      ).rejects.toMatchObject({ code: 'MEMBER_BLOCKED' });
      expect(clientSessions.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyOtp — BIND branch', () => {
    it('binds the phone to the challenge-owning session', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'BIND', memberId: U.line }));
      members.findByPhone.mockResolvedValue(null);
      members.bindVerifiedPhone.mockResolvedValue(member({ id: U.line }));
      await service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), U.line);
      expect(members.bindVerifiedPhone).toHaveBeenCalledWith(U.line, '0812345678');
    });

    it('rejects when the challenge belongs to a different session (401)', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'BIND', memberId: U.owner }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), U.attacker),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(members.bindVerifiedPhone).not.toHaveBeenCalled();
    });

    it('rejects when the phone already belongs to another member (DUPLICATE_MEMBER 409)', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'BIND', memberId: U.line }));
      members.findByPhone.mockResolvedValue(member({ id: U.someoneElse }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), U.line),
      ).rejects.toMatchObject({ code: 'DUPLICATE_MEMBER' });
      expect(members.bindVerifiedPhone).not.toHaveBeenCalled();
    });

    it('allows re-binding the SAME phone already on the current member (idempotent)', async () => {
      const { service, members, otpChallenges } = build();
      otpChallenges.findById.mockResolvedValue(challenge({ purpose: 'BIND', memberId: U.line }));
      members.findByPhone.mockResolvedValue(member({ id: U.line }));
      members.bindVerifiedPhone.mockResolvedValue(member({ id: U.line }));
      await expect(
        service.verifyOtp({ challengeId: 'chal-1', code: '123456' } as any, makeRes(), U.line),
      ).resolves.toBeDefined();
      expect(members.bindVerifiedPhone).toHaveBeenCalledWith(U.line, '0812345678');
    });
  });

  describe('LINE login', () => {
    it('lineLoginUrl returns an authorization url + a state verifiable for the tenant', async () => {
      const { service } = build();
      const out = await runWithTenant(TENANT, () => service.lineLoginUrl());
      expect(out.authorizationUrl).toBe('https://line/authorize?x=1');
      expect(out.state.split('.')[0]).toBe(TENANT);
    });

    it('lineCallback exchanges the code and mints a session for a new LINE member', async () => {
      const { service, members, lineClient, clientSessions } = build();
      lineClient.exchangeCode.mockResolvedValue({ lineUserId: 'linestub_abc' });
      members.findByLineUserId.mockResolvedValue(null);
      members.createFromLineLogin.mockResolvedValue(member({ id: U.newMember, lineUserId: 'linestub_abc', phone: null, phoneVerified: false }));
      const res = makeRes();

      const state = signLineState(TENANT);
      const out = await runWithTenant(TENANT, () =>
        service.lineCallback({ code: 'authcode', state } as any, res),
      );

      expect(members.createFromLineLogin).toHaveBeenCalledWith('linestub_abc');
      expect(out.member.hasLineLogin).toBe(true);
      expect(clientSessions.create).toHaveBeenCalled();
    });

    it('refuses to mint a session for a blocked LINE member (MEMBER_BLOCKED 403)', async () => {
      const { service, members, lineClient, clientSessions } = build();
      lineClient.exchangeCode.mockResolvedValue({ lineUserId: 'linestub_abc' });
      members.findByLineUserId.mockResolvedValue(member({ id: U.ret, lineUserId: 'linestub_abc', isBlocked: true }));

      const state = signLineState(TENANT);
      await expect(
        runWithTenant(TENANT, () => service.lineCallback({ code: 'authcode', state } as any, makeRes())),
      ).rejects.toMatchObject({ code: 'MEMBER_BLOCKED' });
      expect(clientSessions.create).not.toHaveBeenCalled();
    });

    it('lineCallback reuses an existing LINE member (no new row)', async () => {
      const { service, members, lineClient } = build();
      lineClient.exchangeCode.mockResolvedValue({ lineUserId: 'linestub_abc' });
      members.findByLineUserId.mockResolvedValue(member({ id: U.ret, lineUserId: 'linestub_abc' }));
      const state = signLineState(TENANT);
      const out = await runWithTenant(TENANT, () =>
        service.lineCallback({ code: 'authcode', state } as any, makeRes()),
      );
      expect(members.createFromLineLogin).not.toHaveBeenCalled();
      expect(out.member.id).toBe(U.ret);
    });

    it('rejects a forged / cross-tenant LINE state (401) before touching the LINE client', async () => {
      const { service, lineClient } = build();
      const foreignState = signLineState('tenant-other');
      await expect(
        runWithTenant(TENANT, () => service.lineCallback({ code: 'authcode', state: foreignState } as any, makeRes())),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
      expect(lineClient.exchangeCode).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const { service, clientSessions } = build();
      const res = makeRes();
      await service.logout('sess-1', res);
      expect(clientSessions.revoke).toHaveBeenCalledWith('sess-1');
      expect(res.clearCookie).toHaveBeenCalledWith(MEMBER_SESSION_COOKIE, { path: '/' });
    });
  });

  describe('missing tenant config', () => {
    it('throws INTERNAL_ERROR when Config is absent', async () => {
      const { service, configRepo } = build();
      (configRepo.get as jest.Mock).mockResolvedValue(null);
      await expect(
        service.requestOtp({ phone: '0812345678', purpose: 'LOGIN' } as any, null),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });
});
