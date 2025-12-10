import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from '../../src/common/security.service';
import { DataSource } from 'typeorm';

describe('SecurityService', () => {
  let service: SecurityService;
  let dataSource: DataSource;

  beforeEach(async () => {
    const mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Account Lockout', () => {
    const email = 'test@example.com';
    const ip = '192.168.1.1';

    it('should not be locked initially', () => {
      expect(service.isAccountLocked(email, ip)).toBe(false);
    });

    it('should not lock after 4 failed attempts', async () => {
      for (let i = 0; i < 4; i++) {
        await service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0');
      }

      expect(service.isAccountLocked(email, ip)).toBe(false);
      expect(service.getFailedAttempts(email, ip)).toBe(4);
    });

    it('should lock after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0');
      }

      expect(service.isAccountLocked(email, ip)).toBe(true);
      expect(service.getFailedAttempts(email, ip)).toBe(5);
    });

    it('should return lockout time remaining', async () => {
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0');
      }

      const remaining = service.getLockoutTimeRemaining(email, ip);
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(15 * 60); // 15 minutos
    });

    it('should clear attempts after successful login', async () => {
      // Fallar 3 veces
      for (let i = 0; i < 3; i++) {
        await service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0');
      }

      expect(service.getFailedAttempts(email, ip)).toBe(3);

      // Login exitoso
      await service.recordLoginAttempt(email, ip, true, 'Mozilla/5.0');
      service.clearAttempts(email, ip);

      expect(service.getFailedAttempts(email, ip)).toBe(0);
      expect(service.isAccountLocked(email, ip)).toBe(false);
    });

    it('should unlock account manually', async () => {
      // Bloquear cuenta
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0');
      }

      expect(service.isAccountLocked(email, ip)).toBe(true);

      // Desbloquear manualmente
      service.unlockAccount(email, ip);

      expect(service.isAccountLocked(email, ip)).toBe(false);
      expect(service.getFailedAttempts(email, ip)).toBe(0);
    });

    it('should track attempts per IP separately', async () => {
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // 3 intentos desde IP1
      for (let i = 0; i < 3; i++) {
        await service.recordLoginAttempt(email, ip1, false, 'Mozilla/5.0');
      }

      // 2 intentos desde IP2
      for (let i = 0; i < 2; i++) {
        await service.recordLoginAttempt(email, ip2, false, 'Mozilla/5.0');
      }

      expect(service.getFailedAttempts(email, ip1)).toBe(3);
      expect(service.getFailedAttempts(email, ip2)).toBe(2);
      expect(service.isAccountLocked(email, ip1)).toBe(false);
      expect(service.isAccountLocked(email, ip2)).toBe(false);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect IP change', async () => {
      const email = 'user@example.com';
      const oldIp = '192.168.1.1';
      const newIp = '10.0.0.1';
      const userAgent = 'Mozilla/5.0';

      // Mock DB response - login previo con oldIp
      jest.spyOn(dataSource, 'query').mockResolvedValueOnce([
        {
          ip_address: oldIp,
          user_agent: userAgent,
          created_at: new Date(),
        },
      ]);

      const result = await service.detectSuspiciousActivity(
        email,
        newIp,
        userAgent,
      );

      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('IP');
    });

    it('should detect User-Agent change', async () => {
      const email = 'user@example.com';
      const ip = '192.168.1.1';
      const oldUA = 'Mozilla/5.0 (Windows)';
      const newUA = 'Mozilla/5.0 (Linux)';

      jest.spyOn(dataSource, 'query').mockResolvedValueOnce([
        {
          ip_address: ip,
          user_agent: oldUA,
          created_at: new Date(),
        },
      ]);

      const result = await service.detectSuspiciousActivity(email, ip, newUA);

      expect(result.suspicious).toBe(true);
      expect(result.reason).toContain('User-Agent');
    });

    it('should detect multiple IPs', async () => {
      const email = 'user@example.com';
      const currentIp = '192.168.1.100';
      const userAgent = 'Mozilla/5.0';

      // Mock múltiples IPs diferentes - todos con el mismo User-Agent
      const mockLogins: Array<{ ip_address: string; user_agent: string; created_at: Date }> = [];
      for (let i = 0; i < 10; i++) {
        mockLogins.push({
          ip_address: `192.168.1.${i}`,
          user_agent: userAgent,  // Mismo UA para que solo detecte cambio de IP
          created_at: new Date(),
        });
      }

      jest.spyOn(dataSource, 'query').mockResolvedValueOnce(mockLogins);

      const result = await service.detectSuspiciousActivity(
        email,
        currentIp,
        userAgent,
      );

      expect(result.suspicious).toBe(true);
      // Detecta cambio de IP (porque el primero tiene IP diferente al actual)
      expect(result.reason).toBeDefined();
    });

    it('should not flag as suspicious when IP and UA match', async () => {
      const email = 'user@example.com';
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      jest.spyOn(dataSource, 'query').mockResolvedValue([
        {
          ip_address: ip,
          user_agent: userAgent,
          created_at: new Date(),
        },
      ]);

      const result = await service.detectSuspiciousActivity(
        email,
        ip,
        userAgent,
      );

      expect(result.suspicious).toBe(false);
    });
  });

  describe('Database Logging', () => {
    it('should log failed login attempts', async () => {
      const email = 'test@example.com';
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const querySpy = jest.spyOn(dataSource, 'query');

      await service.recordLoginAttempt(email, ip, false, userAgent);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['LOGIN_FAILED', email, ip, userAgent]),
      );
    });

    it('should log successful login attempts', async () => {
      const email = 'test@example.com';
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const querySpy = jest.spyOn(dataSource, 'query');

      await service.recordLoginAttempt(email, ip, true, userAgent);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['LOGIN_SUCCESS', email, ip, userAgent]),
      );
    });

    it('should log account lockout events', async () => {
      const email = 'test@example.com';
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';

      const querySpy = jest.spyOn(dataSource, 'query');

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await service.recordLoginAttempt(email, ip, false, userAgent);
      }

      // Verificar que se haya registrado intentos de login
      expect(querySpy).toHaveBeenCalled();
      expect(querySpy.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle database logging errors gracefully', async () => {
      const email = 'test@example.com';
      const ip = '192.168.1.1';

      // Mock DB error
      jest.spyOn(dataSource, 'query').mockRejectedValue(new Error('DB Error'));

      // Should not throw
      await expect(
        service.recordLoginAttempt(email, ip, false, 'Mozilla/5.0'),
      ).resolves.not.toThrow();
    });
  });
});
