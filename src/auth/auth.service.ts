import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AuditService } from '../common/audit.service';
import { User, UserRole } from '../users/entities/user.entity';

export interface AccessPayload {
  sub: string;
  role: 'ADMIN' | 'REVIEWER' | 'APPLICANT';
  typ: 'access';
  iat: number;
  exp: number;
  aud?: string;
  iss?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private users: UsersService,
    private sessions: SessionsService,
    private onboarding: OnboardingService,
    private auditService: AuditService,
  ) {}

  // ===== Helpers comunes =====

  /** Firma un access token usando AUTH_JWT_* */
  private signAccessToken(user: User) {
    const iss = this.cfg.get<string>('AUTH_JWT_ISS');
    const aud = this.cfg.get<string>('AUTH_JWT_AUD');
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET')!;
    const expiresIn = this.cfg.get<string>('AUTH_JWT_EXPIRES') ?? '900s';

    const payload = {
      sub: user.id,
      role: user.role,
      typ: 'access' as const,
    };

    const options: any = { secret, expiresIn };
    if (iss !== undefined) options.issuer = iss;
    if (aud !== undefined) options.audience = aud;

    return this.jwt.sign(payload, options);
  }

  /** Verifica un access token con AUTH_JWT_* (lanza 401 si es inválido) */
  verifyAccessToken(token: string): AccessPayload {
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET')!;
    const iss = this.cfg.get<string>('AUTH_JWT_ISS');
    const aud = this.cfg.get<string>('AUTH_JWT_AUD');

    const opts: any = { secret };
    if (iss !== undefined) opts.issuer = iss;
    if (aud !== undefined) opts.audience = aud;

    let payload: AccessPayload;
    try {
      payload = this.jwt.verify<AccessPayload>(token, opts);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Wrong token type');
    }
    return payload;
  }

  /** Extrae y verifica el bearer token del header Authorization */
  getUserFromAuthHeader(authorization?: string): AccessPayload {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = authorization.slice('Bearer '.length);
    return this.verifyAccessToken(token);
  }

  private async assertStaff(user: User) {
    if (!user.isActive) throw new ForbiddenException('User inactive');
    if (!(user.role === 'ADMIN' || user.role === 'REVIEWER')) {
      throw new ForbiddenException('Staff only');
    }
  }

  // ===== Flujos de autenticación Staff =====

  async loginStaff(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    await this.assertStaff(user);

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.signAccessToken(user);

    const ttlDays = Number(this.cfg.get('REFRESH_TOKEN_TTL_DAYS') ?? 15);
    const pepper = this.cfg.get<string>('REFRESH_TOKEN_PEPPER') ?? '';
    if (!pepper) throw new Error('REFRESH_TOKEN_PEPPER not set');

    const { session, refreshToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: ua,
      ip,
      ttlDays,
      pepper,
    });

    await this.users.setLastLogin(user.id);

    // Auditoría
    this.auditService
      .logLogin(user.id, user.role, ip)
      .catch(() => {}); // No bloqueante

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
      refresh: { sessionId: session.id, expiresAt: session.expiresAt },
    };
  }

  async refresh(refreshToken: string, ip?: string, ua?: string) {
    const pepper = this.cfg.get<string>('REFRESH_TOKEN_PEPPER') ?? '';
    if (!pepper) throw new Error('REFRESH_TOKEN_PEPPER not set');

    const hash = SessionsService.hmacRefresh(refreshToken, pepper);
    const current = await this.sessions.findActiveByHash(hash);
    if (!current) throw new UnauthorizedException('Invalid refresh');

    if (current.expiresAt.getTime() <= Date.now()) {
      await this.sessions.revokeSession(current.id);
      throw new UnauthorizedException('Expired refresh');
    }

    const user = current.user;
    if (!user?.isActive) {
      await this.sessions.revokeSession(current.id);
      throw new ForbiddenException('User inactive');
    }

    // Rotación: revocar token actual y emitir uno nuevo dentro de la misma familia
    await this.sessions.revokeSession(current.id);

    const ttlDays = Number(this.cfg.get('REFRESH_TOKEN_TTL_DAYS') ?? 15);
    const { session: newSession, refreshToken: newRefresh } =
      await this.sessions.createSession({
        userId: user.id,
        userAgent: ua,
        ip,
        ttlDays,
        pepper,
        rotatedFromSessionId: current.id,
        familyId: current.tokenFamilyId,
      });

    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      refreshToken: newRefresh,
      refresh: { sessionId: newSession.id, expiresAt: newSession.expiresAt },
    };
  }

  async logout(refreshToken: string) {
    const pepper = this.cfg.get<string>('REFRESH_TOKEN_PEPPER') ?? '';
    if (!pepper) return { ok: true };

    try {
      const hash = SessionsService.hmacRefresh(refreshToken, pepper);
      const s = await this.sessions.findActiveByHash(hash);
      if (s) await this.sessions.revokeSession(s.id);
    } catch (_) {}
    return { ok: true };
  }

  // ===== Login con código de invitación (LEGACY - usar /onboarding/validate-invite) =====

  async validateInviteCode(code: string, email?: string, ip?: string, ua?: string) {
    // Si no viene email, buscar el invite primero para obtener email del meta
    let finalEmail = email;
    
    if (!finalEmail) {
      const invite = await this.onboarding.findInviteByCode(code);
      if (!invite) {
        throw new NotFoundException('Código de invitación no encontrado');
      }
      
      // Intentar obtener email del meta
      finalEmail = invite.meta?.testEmail || invite.meta?.email;
      
      if (!finalEmail) {
        throw new BadRequestException('El código no tiene email asociado. Por favor proporciona tu email.');
      }
    }
    
    // Validar el código y obtener/crear usuario
    const { user } = await this.onboarding.validateInviteCode(code, finalEmail);

    // Generar tokens
    const accessToken = this.signAccessToken(user);

    const ttlDays = Number(this.cfg.get('REFRESH_TOKEN_TTL_DAYS') ?? 15);
    const pepper = this.cfg.get<string>('REFRESH_TOKEN_PEPPER') ?? '';
    if (!pepper) throw new Error('REFRESH_TOKEN_PEPPER not set');

    const { session, refreshToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: ua,
      ip,
      ttlDays,
      pepper,
    });

    await this.users.setLastLogin(user.id);

    // Auditoría
    this.auditService
      .logLogin(user.id, user.role, ip)
      .catch(() => {}); // No bloqueante

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      accessToken,
      refreshToken,
      refresh: { sessionId: session.id, expiresAt: session.expiresAt },
    };
  }

  // ==== DEV SEED (solo si ALLOW_DEV_SEED=true) ====
  async devSeedStaff(
    email: string,
    fullName: string,
    role: Exclude<UserRole, 'APPLICANT'>,
    password: string,
  ) {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    return this.users.createStaffIfAllowed(email, fullName, hash, role);
  }
}
