import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para agregar headers de seguridad adicionales
 * que complementan Helmet y otras protecciones
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Prevenir que el navegador mime-sniff el content-type
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevenir que la página sea embebida en iframes (anti-clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Habilitar protección XSS en navegadores antiguos
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Controlar qué información se envía en el Referer header
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Desabilitar funciones del navegador que no se usan
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
    );
    
    // Prevenir que la página sea cacheada si contiene datos sensibles
    if (req.path.includes('/auth') || req.path.includes('/api/users')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Agregar header personalizado para tracking
    res.setHeader('X-Powered-By', 'FCG-Secure-API');
    
    next();
  }
}
