import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AuditService } from '../common/audit.service';
import { SecurityService } from '../common/security.service';
import { EmailService } from '../email/email.service';
import { User, UserRole } from '../users/entities/user.entity';

//ola
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
    private dataSource: DataSource,
    private users: UsersService,
    private sessions: SessionsService,
    private onboarding: OnboardingService,
    private auditService: AuditService,
    private securityService: SecurityService,
    private emailService: EmailService,
  ) {}

  /**
   * Firma un access token JWT para un usuario.
   * Usa configuración AUTH_JWT_SECRET, AUTH_JWT_EXPIRES (default 900s).
   * Incluye sub (user ID), role y typ='access' en el payload.
   * 
   * @param user - Usuario para generar el token
   * @returns JWT firmado
   * 
   * @example
   * const token = this.signAccessToken(user);
   */
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

  /**
   * Verifica y decodifica un access token JWT.
   * 
   * @param token - JWT a verificar
   * @returns Payload decodificado con sub, role y typ
   * @throws {UnauthorizedException} Si el token es inválido o tipo incorrecto
   * 
   * @example
   * const payload = verifyAccessToken('jwt.token.here');
   * // { sub: 'uuid', role: 'APPLICANT', typ: 'access' }
   */
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

  /**
   * Extrae y verifica el bearer token del header Authorization.
   * 
   * @param authorization - Header Authorization (Bearer <token>)
   * @returns Payload decodificado del JWT
   * @throws {UnauthorizedException} Si falta el token o es inválido
   * 
   * @example
   * const payload = getUserFromAuthHeader('Bearer jwt.token.here');
   */
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

  /**
   * Autentica un usuario STAFF (ADMIN o REVIEWER).
   * Verifica credenciales, crea sesión y registra en auditoría.
   * 
   * @param email - Email del staff
   * @param password - Contraseña en texto plano
   * @param ip - IP del cliente opcional
   * @param ua - User agent opcional
   * @returns Tokens de acceso y refresh
   * @throws {UnauthorizedException} Si credenciales inválidas
   * @throws {ForbiddenException} Si el usuario está inactivo o no es staff
   * 
   * @example
   * const tokens = await loginStaff('admin@example.com', 'password123', '127.0.0.1', 'Mozilla');
   */
  async loginStaff(email: string, password: string, ip?: string, ua?: string) {
    // Verificar si la cuenta está bloqueada
    if (this.securityService.isAccountLocked(email, ip || '0.0.0.0')) {
      const remaining = this.securityService.getLockoutTimeRemaining(email, ip || '0.0.0.0');
      throw new ForbiddenException(
        `Account locked due to multiple failed login attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`
      );
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.securityService.recordLoginAttempt(email, ip || '0.0.0.0', false, ua);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.assertStaff(user);

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      await this.securityService.recordLoginAttempt(email, ip || '0.0.0.0', false, ua);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Login exitoso - limpiar intentos fallidos
    await this.securityService.recordLoginAttempt(email, ip || '0.0.0.0', true, ua);
    this.securityService.clearAttempts(email, ip || '0.0.0.0');

    // Detectar actividad sospechosa
    const suspiciousCheck = await this.securityService.detectSuspiciousActivity(
      email,
      ip || '0.0.0.0',
      ua || 'unknown'
    );
    if (suspiciousCheck.suspicious) {
      console.warn(`Suspicious login detected: ${email} - ${suspiciousCheck.reason}`);
    }

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

  /**
   * Renueva un access token usando un refresh token válido.
   * Valida la sesión y genera nuevos tokens.
   * 
   * @param refreshToken - Refresh token JWT
   * @param ip - IP del cliente opcional
   * @param ua - User agent opcional
   * @returns Nuevos tokens de acceso y refresh
   * @throws {UnauthorizedException} Si el refresh token es inválido
   * @throws {ForbiddenException} Si la sesión fue revocada o el usuario inactivo
   * 
   * @example
   * const newTokens = await refresh('refresh.token.jwt', '127.0.0.1', 'Mozilla');
   */
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

  /**
   * Cierra sesión revocando el refresh token.
   * Marca la sesión como revocada en la base de datos.
   * 
   * @param refreshToken - Refresh token JWT a revocar
   * @returns Confirmación de logout
   * @throws {UnauthorizedException} Si el refresh token es inválido
   * 
   * @example
   * await logout('refresh.token.jwt');
   */
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

  // ===== Login normal para postulantes (email + password) =====

  /**
   * Autentica un usuario APPLICANT (postulante).
   * Verifica credenciales, crea sesión y registra en auditoría.
   * 
   * @param email - Email del postulante
   * @param password - Contraseña en texto plano
   * @param ip - IP del cliente opcional
   * @param ua - User agent opcional
   * @returns Tokens de acceso y refresh
   * @throws {UnauthorizedException} Si credenciales inválidas
   * @throws {ForbiddenException} Si el usuario está inactivo o no es applicant
   * 
   * @example
   * const tokens = await loginApplicant('postulante@example.com', 'password123', '127.0.0.1', 'Mozilla');
   */
  async loginApplicant(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // Verificar que sea postulante
    if (user.role !== 'APPLICANT') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Usuario inactivo');
    }

    // Verificar contraseña
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

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

  // ===== Login con código de invitación (LEGACY - usar /onboarding/validate-invite) =====

  async validateInviteCode(code: string, email?: string, ip?: string, ua?: string) {
    // Si no viene email, usar placeholder - el onboarding service lo resolverá del meta
    const finalEmail = email || 'temp@placeholder.com';
    
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

  // ==== PASSWORD RESET ====

  /**
   * Solicita recuperación de contraseña
   * Genera token y envía email
   */
  /**
   * Inicia el proceso de recuperación de contraseña.
   * Genera un token de reseteo y envía email al usuario.
   * 
   * @param email - Email del usuario
   * @returns Mensaje de confirmación
   * @throws {NotFoundException} Si el email no existe
   * 
   * @example
   * const result = await forgotPassword('user@example.com');
   * // { message: 'Email enviado' }
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Buscar usuario por email
    const user = await this.dataSource.query(
      `SELECT id, email, full_name, role, is_active FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email.trim()],
    );

    // Por seguridad, siempre responder lo mismo (evitar enumeration attack)
    const response = { message: 'Si el email existe, recibirás un enlace de recuperación' };

    if (!user || user.length === 0) {
      return response;
    }

    const userData = user[0];

    // Verificar que la cuenta esté activa
    if (!userData.is_active) {
      return response;
    }

    // Generar token único
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Expiración: 24 horas
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Guardar en BD
    await this.dataSource.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userData.id, tokenHash, expiresAt],
    );

    // Enviar email con plantilla
    await this.emailService.sendPasswordResetEmail(
      userData.email,
      token,
      userData.full_name || 'Usuario',
    );

    return response;
  }

  /**
   * Valida un token de reset sin consumirlo
   */
  /**
   * Valida un token de reseteo de contraseña.
   * Verifica que no haya expirado ni sido usado.
   * 
   * @param token - Token de reseteo
   * @returns Objeto con valid y message
   * 
   * @example
   * const result = await validateResetToken('reset.token.123');
   * // { valid: true, message: 'Token válido' }
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; message: string }> {
    if (!token) {
      return { valid: false, message: 'Token requerido' };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await this.dataSource.query(
      `SELECT pr.id
       FROM password_resets pr
       WHERE pr.token_hash = $1
         AND pr.used_at IS NULL
         AND pr.expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );

    if (!result || result.length === 0) {
      return { valid: false, message: 'Token inválido, expirado o ya utilizado' };
    }

    return { valid: true, message: 'Token válido' };
  }

  /**
   * Restablece la contraseña usando el token
   */
  /**
   * Restablece la contraseña usando un token de reseteo válido.
   * Marca el token como usado y actualiza la contraseña del usuario.
   * 
   * @param token - Token de reseteo
   * @param newPassword - Nueva contraseña en texto plano (se hashea)
   * @returns Mensaje de confirmación
   * @throws {BadRequestException} Si el token es inválido o expiró
   * 
   * @example
   * const result = await resetPassword('reset.token.123', 'NewSecurePass123!');
   * // { message: 'Contraseña actualizada' }
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!token || !newPassword) {
      throw new BadRequestException('Token y contraseña son requeridos');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('La contraseña debe tener al menos 8 caracteres');
    }

    // Hash del token para buscar en BD
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar token válido (no usado y no expirado)
    const result = await this.dataSource.query(
      `SELECT pr.id, pr.user_id, u.email, u.full_name
       FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1
         AND pr.used_at IS NULL
         AND pr.expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );

    if (!result || result.length === 0) {
      throw new BadRequestException('Token inválido o expirado');
    }

    const resetData = result[0];

    // Hashear nueva contraseña
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    // Actualizar contraseña del usuario
    await this.dataSource.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, resetData.user_id],
    );

    // Marcar token como usado
    await this.dataSource.query(
      `UPDATE password_resets SET used_at = NOW() WHERE id = $1`,
      [resetData.id],
    );

    // Invalidar todas las sesiones del usuario por seguridad
    await this.sessions.invalidateAllForUser(resetData.user_id);

    return { message: 'Contraseña actualizada correctamente' };
  }
}
