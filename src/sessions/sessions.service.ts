import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { UserSession } from '../users/entities/user-session.entity';
import * as crypto from 'crypto';

/**
 * Servicio de gestión de sesiones de usuario con refresh tokens.
 * 
 * Implementa sistema seguro de sesiones con:
 * - Tokens opacos (base64url) de 32 bytes
 * - Almacenamiento de hash HMAC (no plaintext)
 * - Token family para detección de reuso
 * - Expiración configurable (TTL)
 * - Revocación individual o masiva
 * - Rotación de tokens en cada refresh
 * 
 * Seguridad:
 * - Tokens hasheados con HMAC-SHA256
 * - Pepper configurable por entorno
 * - Token family para detectar sesiones comprometidas
 * - Metadata de user-agent e IP
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(UserSession) private repo: Repository<UserSession>,
  ) {}

  /**
   * Genera un token opaco aleatorio.
   * 
   * Usa crypto.randomBytes para generar 32 bytes seguros.
   * Codifica en base64url para evitar caracteres especiales.
   * 
   * @returns Token de 43 caracteres alfanuméricos (base64url)
   */
  static generateOpaqueToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Genera hash HMAC-SHA256 de un token con pepper.
   * El hash (no el token) se almacena en BD para seguridad.
   * 
   * @param token - Token opaco en claro
   * @param pepper - Secreto configurado en AUTH_REFRESH_PEPPER
   * @returns Hash hexadecimal (64 caracteres)
   */
  static hmacRefresh(token: string, pepper: string) {
    return crypto.createHmac('sha256', pepper).update(token).digest('hex');
  }

  /**
   * Crea una nueva sesión con refresh token.
   * 
   * Flujo:
   * 1. Genera token opaco aleatorio
   * 2. Calcula hash HMAC con pepper
   * 3. Calcula fecha de expiración
   * 4. Genera o reutiliza familyId
   * 5. Guarda sesión en BD
   * 6. Retorna sesión + token en claro (para enviar al cliente)
   * 
   * @param params - Configuración de la sesión:
   *   - userId: ID del usuario
   *   - userAgent: User-Agent del cliente (opcional)
   *   - ip: IP del cliente (opcional)
   *   - ttlDays: Días de validez del token
   *   - pepper: Secreto para HMAC
   *   - rotatedFromSessionId: ID de sesión anterior si es rotación (opcional)
   *   - familyId: ID de familia de tokens (opcional, genera nuevo si no se provee)
   * @returns Objeto con session (entidad guardada) y refreshToken (token en claro para el cliente)
   */
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
    const refreshTokenHash = SessionsService.hmacRefresh(
      refreshToken,
      params.pepper,
    );

    const expiresAt = new Date(
      Date.now() + params.ttlDays * 24 * 60 * 60 * 1000,
    );
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

  /**
   * Busca una sesión activa por hash de refresh token.
   * 
   * Condiciones para sesión activa:
   * - refreshTokenHash coincide
   * - revokedAt es null (no revocada)
   * - expiresAt > now (no expirada, validado en lógica de negocio)
   * 
   * Incluye relación con user para facilitar validación.
   * 
   * @param hash - Hash HMAC del refresh token
   * @returns Sesión con usuario o null si no existe/revocada
   */
  async findActiveByHash(hash: string) {
    return this.repo.findOne({
      where: { refreshTokenHash: hash, revokedAt: IsNull() },
      relations: { user: true },
    });
  }

  /**
   * Revoca una sesión específica.
   * Marca revokedAt con timestamp actual.
   * La sesión ya no podrá usarse para refresh.
   * 
   * @param sessionId - UUID de la sesión a revocar
   */
  async revokeSession(sessionId: string) {
    await this.repo.update(sessionId, { revokedAt: new Date() });
  }

  /**
   * Invalida todas las sesiones activas de un usuario.
   * Útil para:
   * - Logout global (cerrar sesión en todos los dispositivos)
   * - Cambio de contraseña (invalidar sesiones antiguas)
   * - Respuesta a compromiso de seguridad
   * 
   * Solo afecta sesiones no revocadas previamente.
   * 
   * @param userId - UUID del usuario
   */
  async invalidateAllForUser(userId: string) {
    await this.repo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() }
    );
  }
}
