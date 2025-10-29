import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { Invite } from './entities/invite.entity';
import { PasswordSetToken } from './entities/password-set-token.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { SessionsService } from '../sessions/sessions.service';
import { JwtService } from '@nestjs/jwt';

type TimeStr = `${number}${'s' | 'm' | 'h' | 'd'}`; // para @nestjs/jwt types modernos

@Injectable()
export class OnboardingService {
  constructor(
    private cfg: ConfigService,
    @InjectRepository(Invite) private invitesRepo: Repository<Invite>,
    @InjectRepository(PasswordSetToken) private pstRepo: Repository<PasswordSetToken>,
    private users: UsersService,
    private sessions: SessionsService,
    private jwt: JwtService,
  ) {}

  // ==== Helpers
  static hmac(value: string, pepper: string) {
    return crypto.createHmac('sha256', pepper).update(value).digest('hex');
  }
  static randToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
  }
  private ensurePepper(name: string) {
    const v = this.cfg.get<string>(name) ?? '';
    if (!v) throw new Error(`${name} not set`);
    return v;
  }

  // ==== validate-invite
  async validateInvite(code: string, callId: string) {
    const pepper = this.ensurePepper('INVITE_CODE_PEPPER');
    const codeHash = OnboardingService.hmac(code, pepper);

    const invite = await this.invitesRepo.findOne({
      where: { codeHash, callId },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.usedAt) throw new ForbiddenException('Invite already used');
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      throw new ForbiddenException('Invite expired');
    }

    return {
      ok: true,
      inviteId: invite.id,
      callId: invite.callId,
      institutionId: invite.institutionId,
      expiresAt: invite.expiresAt,
    };
  }

  // ==== issue-password-link
  async issuePasswordLink(
    code: string,
    callId: string,
    email: string,
    fullName?: string,
    ip?: string,
    ua?: string,
  ) {
    await this.validateInvite(code, callId); // valida (lanza si no existe/expirado/usado)
    const pepper = this.ensurePepper('PASSWORD_SET_PEPPER');

    // Asegurar user APPLICANT por email
    let user = await this.users.findByEmail(email);
    if (!user) {
      if (!fullName) throw new BadRequestException('fullName required for new applicant');
      // Crear user con password temporal (se reemplaza en set-password)
      const tmpPass = OnboardingService.randToken(18);
      const hash = await argon2.hash(tmpPass, { type: argon2.argon2id });
      user = await this.users.createApplicantUser(email, fullName, hash);
    } else if (user.role !== 'APPLICANT') {
      throw new ForbiddenException('Email already used by staff');
    } else if (!user.isActive) {
      throw new ForbiddenException('User inactive');
    }

    // Crear token one-time para set-password
    const ttlMin = Number(this.cfg.get('PASSWORD_SET_TTL_MIN') ?? 60);
    const plain = OnboardingService.randToken(32);
    const tokenHash = OnboardingService.hmac(plain, pepper);
    const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

    const pst = this.pstRepo.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      issuedIp: ip ?? null,
      issuedUserAgent: ua ?? null,
      usedAt: null,
      consumedIp: null,
      consumedUserAgent: null,
    });
    await this.pstRepo.save(pst);

    // Por ahora devolvemos el token en la respuesta para pruebas
    return {
      ok: true,
      userId: user.id,
      token: plain,
      expiresAt,
    };
  }

  // ==== set-password
  async setPassword(token: string, newPassword: string, ip?: string, ua?: string) {
    const pepper = this.ensurePepper('PASSWORD_SET_PEPPER');
    const tokenHash = OnboardingService.hmac(token, pepper);

    const pst = await this.pstRepo.findOne({ where: { tokenHash } });
    if (!pst) throw new UnauthorizedException('Invalid token');
    if (pst.usedAt) throw new ForbiddenException('Token already used');
    if (pst.expiresAt.getTime() <= Date.now()) throw new ForbiddenException('Token expired');

    const user = await this.users.findById(pst.userId);
    if (!user || !user.isActive) throw new ForbiddenException('User inactive');

    const hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.users.updatePassword(user.id, hash);

    pst.usedAt = new Date();
    pst.consumedIp = ip ?? null;
    pst.consumedUserAgent = ua ?? null;
    await this.pstRepo.save(pst);

    return { ok: true };
  }

  // ==== login applicant
  private signAccessToken(user: User) {
    const iss = this.cfg.get<string>('AUTH_JWT_ISS');
    const aud = this.cfg.get<string>('AUTH_JWT_AUD');
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET')!;

    // Tipado seguro para evitar el error de overload:
    const raw = this.cfg.get<string>('AUTH_JWT_EXPIRES') ?? '900s';
    const expiresIn: number | TimeStr = /^\d+$/.test(raw)
      ? Number(raw)
      : (raw as TimeStr); // fuerza a template literal válido (e.g., "15m", "900s")

    const payload = { sub: user.id, role: user.role, typ: 'access' as const };
    return this.jwt.sign(payload, { secret, expiresIn, issuer: iss, audience: aud });
  }

  async loginApplicant(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.role !== 'APPLICANT') throw new ForbiddenException('Applicant only');
    if (!user.isActive) throw new ForbiddenException('User inactive');

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.signAccessToken(user);

    const ttlDays = Number(this.cfg.get('REFRESH_TOKEN_TTL_DAYS') ?? 15);
    const pepper = this.ensurePepper('REFRESH_TOKEN_PEPPER');

    const { session, refreshToken } = await this.sessions.createSession({
      userId: user.id,
      userAgent: ua,
      ip,
      ttlDays,
      pepper,
    });

    await this.users.setLastLogin(user.id);

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      accessToken,
      refreshToken,
      refresh: { sessionId: session.id, expiresAt: session.expiresAt },
    };
  }

  // ==== SOLO DEV: crear invite rápido
  async devCreateInvite(
    callId: string,
    codePlain: string,
    ttlDays?: number,
    institutionId?: string,
    creatorUserId?: string,
  ) {
    const pepper = this.ensurePepper('INVITE_CODE_PEPPER');
    const codeHash = OnboardingService.hmac(codePlain, pepper);
    const expiresAt =
      ttlDays && ttlDays > 0 ? new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000) : null;

    const existing = await this.invitesRepo.findOne({ where: { codeHash, callId } });
    if (existing) throw new BadRequestException('Invite code already exists for this call');

    const inv = this.invitesRepo.create({
      callId,
      institutionId: institutionId ?? null,
      codeHash,
      expiresAt,
      usedAt: null,
      usedByApplicant: null,
      meta: null,
      createdByUserId: creatorUserId ?? null,
    });
    await this.invitesRepo.save(inv);
    return { ok: true, inviteId: inv.id };
  }
}
