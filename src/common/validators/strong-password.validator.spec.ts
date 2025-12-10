import { validate } from 'class-validator';
import { IsStrongPassword } from './strong-password.validator';

class TestDto {
  @IsStrongPassword()
  password: string;
}

describe('StrongPasswordValidator', () => {
  async function validatePassword(password: string) {
    const dto = new TestDto();
    dto.password = password;
    const errors = await validate(dto);
    return errors;
  }

  describe('Password Length', () => {
    it('should reject passwords shorter than 12 characters', async () => {
      const errors = await validatePassword('Short1!');
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = errors[0].constraints?.IsStrongPassword || errors[0].constraints?.isStrongPassword;
      expect(errorMessage).toBeDefined();
    });

    it('should accept passwords with exactly 12 characters', async () => {
      const errors = await validatePassword('ValidPass1!@');
      expect(errors.length).toBe(0);
    });

    it('should accept long passwords', async () => {
      const errors = await validatePassword(
        'ThisIsAVeryL0ngAndS3cur3Phr@se!@#',
      );
      expect(errors.length).toBe(0);
    });
  });

  describe('Character Requirements', () => {
    it('should reject passwords without uppercase letters', async () => {
      const errors = await validatePassword('nouppercas3!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without lowercase letters', async () => {
      const errors = await validatePassword('NOLOWERCASE3!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without numbers', async () => {
      const errors = await validatePassword('NoNumbersHere!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords without special characters', async () => {
      const errors = await validatePassword('NoSpecialChar1');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept passwords with all requirements', async () => {
      const errors = await validatePassword('V@lidPhr@se1!');
      expect(errors.length).toBe(0);
    });
  });

  describe('Common Passwords', () => {
    it('should reject "password123"', async () => {
      const errors = await validatePassword('Password123!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "admin12345"', async () => {
      const errors = await validatePassword('Admin12345!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "welcome123"', async () => {
      const errors = await validatePassword('Welcome123!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "letmein123"', async () => {
      const errors = await validatePassword('Letmein123!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject "qwerty123456"', async () => {
      const errors = await validatePassword('Qwerty123456!');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Sequential Patterns', () => {
    it('should reject passwords with "abc" sequence', async () => {
      const errors = await validatePassword('Password1abc!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords with "123" sequence', async () => {
      const errors = await validatePassword('Password123!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords with "qwerty" sequence', async () => {
      const errors = await validatePassword('Passwordqwerty1!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept passwords without sequential patterns', async () => {
      const errors = await validatePassword('P@ssw0rdS3cur3');
      expect(errors.length).toBe(0);
    });
  });

  describe('Repeated Characters', () => {
    it('should reject passwords with 3 consecutive repeated characters', async () => {
      const errors = await validatePassword('Passsword111!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject passwords with 4 consecutive repeated characters', async () => {
      const errors = await validatePassword('Passssword1!');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept passwords with 2 repeated characters', async () => {
      const errors = await validatePassword('Myp@55phrase!');
      expect(errors.length).toBe(0);
    });

    it('should accept passwords with non-consecutive repeated chars', async () => {
      const errors = await validatePassword('S3cur3Phr@z3!');
      expect(errors.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null password', async () => {
      const dto = new TestDto();
      (dto as any).password = null;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined password', async () => {
      const dto = new TestDto();
      (dto as any).password = undefined;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle empty string', async () => {
      const errors = await validatePassword('');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle whitespace-only password', async () => {
      const errors = await validatePassword('            ');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle special characters correctly', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const errors = await validatePassword(`SecureP@ss1${specialChars}`);
      expect(errors.length).toBe(0);
    });

    it('should handle unicode characters', async () => {
      const errors = await validatePassword('Contraseña123!');
      expect(errors.length).toBe(0);
    });
  });

  describe('Real-World Examples', () => {
    const validPasswords = [
      'MyS3cur3P@ssw0rd',
      'C0mpl3x!P@ssword',
      'Str0ng&S3cur3Pwd',
      'V3ry!Str0ng#Pass',
      'S@f3P@ssw0rd2024',
      'Un1qu3P@ssw0rd!',
      'Gr3@tP@ssw0rd#1',
    ];

    const invalidPasswords = [
      'password', // too short
      'password123', // too short
      'PASSWORD123!', // no lowercase
      'password123!', // no uppercase
      'Password!!!', // no number
      'Password123', // no special
      'Password123!', // sequential 123
      'Passwordabc!', // sequential abc
      'Passssword1!', // repeated chars
      'Welcome123!', // common password
      'Admin12345!', // common password
    ];

    validPasswords.forEach((pwd) => {
      it(`should accept valid password: ${pwd}`, async () => {
        const errors = await validatePassword(pwd);
        expect(errors.length).toBe(0);
      });
    });

    invalidPasswords.forEach((pwd) => {
      it(`should reject invalid password: ${pwd}`, async () => {
        const errors = await validatePassword(pwd);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});
