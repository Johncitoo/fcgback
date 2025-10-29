import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserSession } from '../users/entities/user-session.entity';
import * as crypto from 'crypto';

@Injectable()
export class SessionsService {
  constructor(@InjectRepository(UserSession) private repo: Repository<UserSession>) {}

  /** Genera un token opaco aleatorio (base64url). */
  static generateOpaqueToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /** HMAC( token , pepper ) en hex — lo que guardamos en BD. */
  static hmacRefresh(token: string, pepper: string) {
    return crypto.createHmac('sha256', pepper).update(token).digest('hex');
  }

  /** Crea sesión y devuelve { session, refreshToken } (el token opaco en claro para el cliente). */
  async createSession(params: {
    userId: string;
    userAgent?: string | null;
    ip?: string | null;
    ttlDays: number;
    pepper: string;
    rotatedFromSessionId?: string | null;
    familyId?: string | null;
  }) {
    const refreshToken = SessionsService.generateOpaqueToken();
    const refreshTokenHash = SessionsService.hmacRefresh(refreshToken, params.pepper);

    const expiresAt = new Date(Date.now() + params.ttlDays * 24 * 60 * 60 * 1000);
    const tokenFamilyId = params.familyId ?? crypto.randomUUID();

    const entity = this.repo.create({
      userId: params.userId,
      refreshTokenHash,
      tokenFamilyId,
      rotatedFromSessionId: params.rotatedFromSessionId ?? null,
      userAgent: params.userAgent ?? null,
      ip: params.ip ?? null,
      expiresAt,
      revokedAt: null,
    });

    const session = await this.repo.save(entity);
    return { session, refreshToken };
  }

  /** Busca una sesión activa por hash de refresh (no expirada y no revocada). */
  async findActiveByHash(hash: string) {
    return this.repo.findOne({
      where: { refreshTokenHash: hash, revokedAt: IsNull() },
      relations: { user: true },
    });
  }

  /** Marca una sesión como revocada. */
  async revokeSession(sessionId: string) {
    await this.repo.update(sessionId, { revokedAt: new Date() });
  }
}
