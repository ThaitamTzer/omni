import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_TOKEN_DAYS = 30;
const REFRESH_COOKIE = 'omni_refresh';

type RequestWithCookies = Request & { cookies?: Record<string, string> };

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions(isProd: boolean) {
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax' as const,
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
    };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, this.cookieOptions(process.env.NODE_ENV === 'production'));
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  private async issueTokens(staff: { id: string; email: string; role: string }) {
    // Access token — short lived (7d default from env)
    const accessToken = await this.jwt.signAsync({
      sub: staff.id,
      email: staff.email,
      role: staff.role,
    });

    // Refresh token — random, stored hashed, 30 days
    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        staffId: staff.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  async login(email: string, password: string, res: Response) {
    const staff = await this.prisma.staff.findUnique({ where: { email } });
    if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const { accessToken, refreshToken } = await this.issueTokens(staff);
    this.setRefreshCookie(res, refreshToken);
    return {
      token: accessToken,
      staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    };
  }

  /**
   * Exchange a valid refresh token (from HttpOnly cookie) for a new access token + rotate refresh token.
   */
  async refresh(req: RequestWithCookies, res: Response) {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Thiếu refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { staff: true },
    });

    // Invalid, expired, or revoked
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Rotate: revoke old, issue new pair
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken: newRefreshToken } = await this.issueTokens(record.staff);
    this.setRefreshCookie(res, newRefreshToken);
    return {
      token: accessToken,
      staff: { id: record.staff.id, email: record.staff.email, name: record.staff.name, role: record.staff.role },
    };
  }

  /**
   * Revoke a refresh token (logout).
   */
  async logout(req: RequestWithCookies, res: Response) {
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE];
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  async list() {
    const staff = await this.prisma.staff.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return staff;
  }

  async create(data: { email: string; name: string; password: string; role: 'ADMIN' | 'AGENT' }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.staff.create({
      data: { email: data.email, name: data.name, passwordHash, role: data.role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
  }
}
