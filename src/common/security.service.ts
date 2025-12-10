import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface LoginAttempt {
  email: string;
  ip: string;
  timestamp: Date;
  success: boolean;
}

@Injectable()
export class SecurityService {
  private failedAttempts: Map<string, LoginAttempt[]> = new Map();
  private lockedAccounts: Map<string, Date> = new Map();

  // Configuración
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly ATTEMPT_WINDOW_MINUTES = 30;

  constructor(private dataSource: DataSource) {
    // Limpiar intentos antiguos cada 5 minutos
    setInterval(() => this.cleanupOldAttempts(), 5 * 60 * 1000);
  }

  /**
   * Registra un intento de login
   */
  async recordLoginAttempt(
    email: string,
    ip: string,
    success: boolean,
    userAgent?: string,
  ): Promise<void> {
    const key = this.getKey(email, ip);
    const attempt: LoginAttempt = {
      email,
      ip,
      timestamp: new Date(),
      success,
    };

    // Guardar en memoria
    if (!this.failedAttempts.has(key)) {
      this.failedAttempts.set(key, []);
    }
    this.failedAttempts.get(key)!.push(attempt);

    // Guardar en DB para auditoría
    await this.logToDatabase(email, ip, success, userAgent);

    // Si falló, verificar si debe bloquearse
    if (!success) {
      await this.checkAndLockAccount(email, ip);
    }
  }

  /**
   * Verifica si una cuenta está bloqueada
   */
  isAccountLocked(email: string, ip: string): boolean {
    const key = this.getKey(email, ip);
    const lockUntil = this.lockedAccounts.get(key);

    if (!lockUntil) {
      return false;
    }

    // Si el bloqueo expiró, remover
    if (new Date() > lockUntil) {
      this.lockedAccounts.delete(key);
      this.failedAttempts.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Obtiene el tiempo restante de bloqueo en segundos
   */
  getLockoutTimeRemaining(email: string, ip: string): number {
    const key = this.getKey(email, ip);
    const lockUntil = this.lockedAccounts.get(key);

    if (!lockUntil) {
      return 0;
    }

    const remaining = Math.ceil((lockUntil.getTime() - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  }

  /**
   * Obtiene el número de intentos fallidos recientes
   */
  getFailedAttempts(email: string, ip: string): number {
    const key = this.getKey(email, ip);
    const attempts = this.failedAttempts.get(key) || [];
    
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - this.ATTEMPT_WINDOW_MINUTES);

    return attempts.filter(
      a => !a.success && a.timestamp > windowStart
    ).length;
  }

  /**
   * Limpia intentos de login exitoso
   */
  clearAttempts(email: string, ip: string): void {
    const key = this.getKey(email, ip);
    this.failedAttempts.delete(key);
    this.lockedAccounts.delete(key);
  }

  /**
   * Desbloquea manualmente una cuenta (para admins)
   */
  unlockAccount(email: string, ip: string): void {
    const key = this.getKey(email, ip);
    this.lockedAccounts.delete(key);
    this.failedAttempts.delete(key);
  }

  // ===== Métodos privados =====

  private getKey(email: string, ip: string): string {
    return `${email.toLowerCase()}:${ip}`;
  }

  private async checkAndLockAccount(email: string, ip: string): Promise<void> {
    const failedCount = this.getFailedAttempts(email, ip);

    if (failedCount >= this.MAX_FAILED_ATTEMPTS) {
      const key = this.getKey(email, ip);
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCKOUT_DURATION_MINUTES);
      
      this.lockedAccounts.set(key, lockUntil);

      // Log evento de bloqueo
      console.warn(`🔒 Account locked: ${email} from IP ${ip} - ${failedCount} failed attempts`);
      
      await this.dataSource.query(
        `INSERT INTO audit_logs (event_type, user_email, ip_address, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [
          'ACCOUNT_LOCKED',
          email,
          ip,
          JSON.stringify({
            failedAttempts: failedCount,
            lockDuration: this.LOCKOUT_DURATION_MINUTES,
          }),
        ]
      );
    }
  }

  private async logToDatabase(
    email: string,
    ip: string,
    success: boolean,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.dataSource.query(
        `INSERT INTO audit_logs (event_type, user_email, ip_address, user_agent, details, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
          email,
          ip,
          userAgent || 'unknown',
          JSON.stringify({ timestamp: new Date().toISOString() }),
        ]
      );
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  }

  private cleanupOldAttempts(): void {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - this.ATTEMPT_WINDOW_MINUTES);

    for (const [key, attempts] of this.failedAttempts.entries()) {
      const recentAttempts = attempts.filter(a => a.timestamp > cutoff);
      
      if (recentAttempts.length === 0) {
        this.failedAttempts.delete(key);
      } else {
        this.failedAttempts.set(key, recentAttempts);
      }
    }
  }

  /**
   * Detecta actividad sospechosa
   */
  async detectSuspiciousActivity(
    email: string,
    ip: string,
    userAgent: string,
  ): Promise<{ suspicious: boolean; reason?: string }> {
    // Verificar cambio de IP repentino
    const recentLogins = await this.dataSource.query(
      `SELECT ip_address, user_agent, created_at
       FROM audit_logs
       WHERE user_email = $1 AND event_type = 'LOGIN_SUCCESS'
       ORDER BY created_at DESC
       LIMIT 10`,
      [email]
    );

    if (recentLogins.length > 0) {
      const lastIp = recentLogins[0].ip_address;
      const lastUA = recentLogins[0].user_agent;

      // Cambio de IP
      if (lastIp && lastIp !== ip) {
        return {
          suspicious: true,
          reason: 'IP address changed from previous login',
        };
      }

      // Cambio de User-Agent
      if (lastUA && lastUA !== userAgent) {
        return {
          suspicious: true,
          reason: 'User-Agent changed from previous login',
        };
      }

      // Múltiples IPs en corto tiempo
      const uniqueIps = new Set(recentLogins.map((r: any) => r.ip_address));
      if (uniqueIps.size > 5) {
        return {
          suspicious: true,
          reason: 'Multiple IPs detected',
        };
      }
    }

    return { suspicious: false };
  }
}
