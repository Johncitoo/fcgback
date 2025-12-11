import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para logging de requests sospechosos
 * Detecta patrones de ataques comunes
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('SecurityMonitor');

  use(req: Request, res: Response, next: NextFunction) {
    const suspiciousPatterns = [
      // SQL Injection patterns (solo en query params y body, no en URL)
      /(\bUNION\b|\bSELECT\b|\bDROP\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b)/i,
      // XSS patterns
      /<script|javascript:|onerror=|onload=/i,
      // Path traversal
      /\.\.[\/\\]/,
      // Command injection (sin $ para evitar falsos positivos con User-Agents)
      /[;&|`]/,
    ];

    // Solo revisar URL, query params y body (no headers como User-Agent)
    const url = req.url;
    const body = JSON.stringify(req.body);
    const query = JSON.stringify(req.query);
    const fullRequest = `${url} ${body} ${query}`;

    // Detectar patrones sospechosos
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullRequest)) {
        this.logger.warn(
          `🚨 Suspicious request detected from ${req.ip}: ${req.method} ${req.path}`
        );
        this.logger.warn(`Pattern matched: ${pattern.toString()}`);
        this.logger.warn(`User-Agent: ${req.headers['user-agent']}`);
        break;
      }
    }

    // Log requests lentos (potenciales DoS)
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 5000) {
        this.logger.warn(
          `⏱️  Slow request: ${req.method} ${req.path} took ${duration}ms`
        );
      }
    });

    next();
  }
}
