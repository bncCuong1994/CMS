import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { LoginResponse, MeResponse } from '@cms/shared-types';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string, meta: { ip?: string; userAgent?: string }): Promise<LoginResponse> {
    const user = await this.prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
    // Cùng một thông báo cho sai email và sai mật khẩu để không lộ email nào tồn tại.
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user.status !== 'active') throw new UnauthorizedException('Tài khoản đã bị khoá');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now, lastActivityAt: now } });
      await this.audit.event({ userId: user.id, eventType: 'login', metadata: { ip: meta.ip } }, tx);
    });

    return { ...(await this.issueTokens(user.id, meta)), user: await this.me(user.id) };
  }

  async refresh(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException();
    if (stored.user.status !== 'active' || stored.user.deletedAt) throw new UnauthorizedException();

    // Xoay vòng: token cũ bị thu hồi, cấp token mới.
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: await this.rbac.getRoleAssignments(user.id),
      grants: await this.rbac.getGrants(user.id),
    };
  }

  private async issueTokens(userId: string, meta: { ip?: string; userAgent?: string }) {
    const accessToken = await this.jwt.signAsync({ sub: userId });
    const refreshToken = randomBytes(48).toString('base64url');
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 7);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + days * 86_400_000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, refreshToken };
  }
}
