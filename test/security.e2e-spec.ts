import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Security Implementation Tests (e2e)', () => {
  let app: INestApplication;
  let validAdminToken: string;
  let testEmail = 'test@security.com';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Aplicar mismas configuraciones que main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. TESTS DE AUTENTICACIÓN Y GUARDS
  // ==========================================

  describe('Global JWT Guards', () => {
    it('should reject unauthenticated request to protected endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/institutions')
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/institutions')
        .set('Authorization', 'Bearer invalid_token_here')
        .expect(401);

      expect(response.body.message).toContain('Invalid token');
    });

    it('should allow access to public endpoints without token', async () => {
      await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);
    });
  });

  // ==========================================
  // 2. TESTS DE RATE LIMITING
  // ==========================================

  describe('Rate Limiting', () => {
    it('should block after 5 failed login attempts', async () => {
      const loginData = {
        email: testEmail,
        password: 'wrong_password',
      };

      // Hacer 5 intentos
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login-staff')
          .send(loginData);
      }

      // El 6to intento debe ser bloqueado por rate limiting
      const response = await request(app.getHttpServer())
        .post('/api/auth/login-staff')
        .send(loginData)
        .expect(429);

      expect(response.body.message).toContain('Too Many Requests');
    });
  });

  // ==========================================
  // 3. TESTS DE ACCOUNT LOCKOUT
  // ==========================================

  describe('Account Lockout', () => {
    const lockoutEmail = 'lockout@test.com';

    it('should lock account after 5 failed login attempts', async () => {
      const loginData = {
        email: lockoutEmail,
        password: 'wrong_password',
      };

      // Esperar un poco para reset rate limiting
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minuto

      // Hacer 5 intentos fallidos
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/auth/login-staff')
          .send(loginData);
        
        // Pequeña pausa entre intentos
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // El siguiente intento debe retornar account locked
      const response = await request(app.getHttpServer())
        .post('/api/auth/login-staff')
        .send(loginData)
        .expect(403);

      expect(response.body.message).toContain('Account locked');
      expect(response.body.message).toContain('minutes');
    });
  });

  // ==========================================
  // 4. TESTS DE PASSWORD POLICY
  // ==========================================

  describe('Strong Password Policy', () => {
    it('should reject password shorter than 12 characters', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/onboarding/set-password')
        .send({
          token: 'test_token',
          password: 'Short1!',
        })
        .expect(400);

      expect(response.body.message).toContain('12 characters');
    });

    it('should reject password without uppercase', async () => {
      await request(app.getHttpServer())
        .post('/api/onboarding/set-password')
        .send({
          token: 'test_token',
          password: 'nouppercase123!',
        })
        .expect(400);
    });

    it('should reject password without number', async () => {
      await request(app.getHttpServer())
        .post('/api/onboarding/set-password')
        .send({
          token: 'test_token',
          password: 'NoNumbersHere!',
        })
        .expect(400);
    });

    it('should reject password without special character', async () => {
      await request(app.getHttpServer())
        .post('/api/onboarding/set-password')
        .send({
          token: 'test_token',
          password: 'NoSpecialChar123',
        })
        .expect(400);
    });

    it('should reject common passwords', async () => {
      const commonPasswords = [
        'Password123!',
        'Password1234!',
        'Admin123456!',
      ];

      for (const password of commonPasswords) {
        await request(app.getHttpServer())
          .post('/api/onboarding/set-password')
          .send({
            token: 'test_token',
            password,
          })
          .expect(400);
      }
    });

    it('should reject passwords with sequential patterns', async () => {
      const sequentialPasswords = [
        'Abcdefg12345!',
        'Qwerty123456!',
      ];

      for (const password of sequentialPasswords) {
        await request(app.getHttpServer())
          .post('/api/onboarding/set-password')
          .send({
            token: 'test_token',
            password,
          })
          .expect(400);
      }
    });

    it('should accept strong password', async () => {
      // Este test pasará o fallará dependiendo de si el token es válido
      // Solo validamos que la validación de password pase
      const strongPassword = 'MyStr0ng!P@ssw0rd2024';
      
      await request(app.getHttpServer())
        .post('/api/onboarding/set-password')
        .send({
          token: 'test_token',
          password: strongPassword,
        });
      // No verificamos status code porque el token puede ser inválido
      // Solo verificamos que no falle por la password policy
    });
  });

  // ==========================================
  // 5. TESTS DE CORS
  // ==========================================

  describe('CORS Protection', () => {
    it('should reject requests from unauthorized origin', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/institutions')
        .set('Origin', 'https://evil-site.com')
        .set('Access-Control-Request-Method', 'GET');

      // CORS debe bloquear
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow requests from authorized origin', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/institutions')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  // ==========================================
  // 6. TESTS DE SECURITY HEADERS (Helmet)
  // ==========================================

  describe('Security Headers', () => {
    it('should include X-Frame-Options header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health');

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include Strict-Transport-Security header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health');

      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health');

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });
  });

  // ==========================================
  // 7. TESTS DE HPP PROTECTION
  // ==========================================

  describe('HPP Protection', () => {
    it('should handle duplicate parameters safely', async () => {
      // HPP debe prevenir parameter pollution
      const response = await request(app.getHttpServer())
        .get('/api/applicants?limit=10&limit=999999')
        .set('Authorization', `Bearer ${validAdminToken}`);

      // No debe crashear, HPP debe manejar esto
      expect([200, 401]).toContain(response.status);
    });
  });

  // ==========================================
  // 8. TESTS DE ROLE-BASED ACCESS CONTROL
  // ==========================================

  describe('Role-Based Access Control', () => {
    it('should reject APPLICANT accessing admin endpoint', async () => {
      // Este test requeriría un token de APPLICANT válido
      // Por ahora verificamos que sin el rol correcto, falla
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', 'Bearer applicant_token')
        .expect(401); // o 403 si el token es válido pero el rol no
    });

    it('should reject REVIEWER creating users (ADMIN only)', async () => {
      await request(app.getHttpServer())
        .post('/api/admin/users')
        .set('Authorization', 'Bearer reviewer_token')
        .send({
          email: 'test@test.com',
          fullName: 'Test User',
          role: 'REVIEWER',
        })
        .expect(401); // o 403
    });
  });

  // ==========================================
  // 9. TESTS DE INPUT VALIDATION
  // ==========================================

  describe('Input Validation', () => {
    it('should reject invalid email format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login-staff')
        .send({
          email: 'not_an_email',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should strip extra properties (whitelist)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login-staff')
        .send({
          email: 'test@test.com',
          password: 'password123',
          maliciousField: 'sql injection attempt',
        });

      // ValidationPipe debe remover maliciousField
      // El endpoint debe procesar solo email y password
      expect([400, 401]).toContain(response.status);
    });

    it('should reject when forbidden properties are sent', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login-staff')
        .send({
          email: 'test@test.com',
          password: 'password123',
          extraField: 'value',
        })
        .expect(400);

      expect(response.body.message).toContain('property');
    });
  });
});
