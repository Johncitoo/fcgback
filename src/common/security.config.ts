/**
 * 🔒 GUÍA DE SEGURIDAD - FUNDACIÓN CARMEN GOUDIE
 * 
 * Este archivo documenta todas las medidas de seguridad implementadas
 * y las mejores prácticas a seguir durante el desarrollo.
 */

export const SECURITY_CONFIG = {
  // === AUTENTICACIÓN ===
  authentication: {
    jwtExpiration: '15m', // Tokens de corta duración
    refreshTokenExpiration: '15d',
    passwordMinLength: 12,
    passwordRequirements: [
      'Al menos una mayúscula',
      'Al menos una minúscula',
      'Al menos un número',
      'Al menos un carácter especial',
      'No contraseñas comunes',
    ],
    accountLockout: {
      maxAttempts: 5,
      lockoutDuration: '15 minutes',
    },
  },

  // === RATE LIMITING ===
  rateLimiting: {
    short: { ttl: 1000, limit: 10 }, // 10 req/segundo
    medium: { ttl: 60000, limit: 100 }, // 100 req/minuto
    long: { ttl: 900000, limit: 500 }, // 500 req/15min
    authentication: { ttl: 60000, limit: 5 }, // 5 intentos/minuto
  },

  // === HEADERS DE SEGURIDAD ===
  securityHeaders: {
    helmet: true,
    csp: true,
    hsts: true,
    noSniff: true,
    xssProtection: true,
    frameguard: 'DENY',
  },

  // === CORS ===
  cors: {
    useWhitelist: true,
    allowedOrigins: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://fcg-production.up.railway.app',
      'https://fundacioncarmesgoudie.vercel.app',
      'https://fcgfront.vercel.app',
    ],
    credentials: true,
  },

  // === VALIDACIÓN DE DATOS ===
  validation: {
    whitelist: true, // Elimina propiedades no definidas
    forbidNonWhitelisted: true, // Rechaza propiedades extra
    transform: true, // Transforma tipos automáticamente
  },

  // === PROTECCIONES IMPLEMENTADAS ===
  protections: [
    '✅ Helmet (11 protecciones HTTP)',
    '✅ HPP (HTTP Parameter Pollution)',
    '✅ Data Sanitization (NoSQL injection)',
    '✅ Compression (Performance)',
    '✅ Rate Limiting (3 niveles)',
    '✅ Account Lockout (5 intentos)',
    '✅ JWT Auth + Roles',
    '✅ ValidationPipe (DTOs)',
    '✅ CORS Whitelist',
    '✅ Argon2 Password Hashing',
    '✅ File Validation (Magic Numbers)',
    '✅ Suspicious Activity Detection',
    '✅ Audit Logging',
    '✅ SSL/TLS en producción',
  ],

  // === VARIABLES DE ENTORNO REQUERIDAS ===
  requiredEnvVars: [
    'DATABASE_URL',
    'AUTH_JWT_SECRET',
    'REFRESH_TOKEN_PEPPER',
    'INVITE_CODE_PEPPER', // ⚠️ CRÍTICO
    'BREVO_API_KEY',
    'FRONTEND_URL',
    'CORS_ORIGINS',
  ],

  // === CHECKLIST DE DEPLOYMENT ===
  deploymentChecklist: [
    '☐ Cambiar AUTH_JWT_SECRET (mínimo 64 caracteres)',
    '☐ Cambiar REFRESH_TOKEN_PEPPER (mínimo 64 caracteres)',
    '☐ Configurar INVITE_CODE_PEPPER (mínimo 64 caracteres)',
    '☐ Habilitar DATABASE_SSL=true',
    '☐ Configurar CORS_ORIGINS con dominios reales',
    '☐ Verificar BREVO_API_KEY',
    '☐ NODE_ENV=production',
    '☐ Verificar que no hay logs de contraseñas/tokens',
    '☐ Ejecutar npm audit fix',
    '☐ Verificar todos los tests pasan (75/75)',
  ],

  // === ENDPOINTS PÚBLICOS (sin autenticación) ===
  publicEndpoints: [
    'POST /api/onboarding/validate-invite',
    'POST /api/onboarding/set-password',
    'POST /api/onboarding/dev/create-invite (solo dev)',
    'GET /api/form/public/:callId',
  ],

  // === MONITOREO ===
  monitoring: {
    logSuspiciousRequests: true,
    logSlowRequests: true, // > 5 segundos
    logFailedLogins: true,
    logAccountLockouts: true,
    alertOnMultipleFailedAttempts: true,
  },
};

/**
 * Valida que todas las variables de entorno críticas estén configuradas
 */
export function validateSecurityConfig(): string[] {
  const missing: string[] = [];
  
  for (const envVar of SECURITY_CONFIG.requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  return missing;
}

/**
 * Genera un secreto seguro aleatorio
 * Usar para generar AUTH_JWT_SECRET, REFRESH_TOKEN_PEPPER, etc.
 */
export function generateSecureSecret(length: number = 64): string {
  const crypto = require('crypto');
  return crypto.randomBytes(length).toString('hex');
}

// Exportar configuración
export default SECURITY_CONFIG;
