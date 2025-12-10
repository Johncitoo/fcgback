import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Lista de contraseñas comunes prohibidas
const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567',
  'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine',
  'ashley', 'bailey', 'passw0rd', 'shadow', '123123', '654321', 'superman',
  'qazwsx', 'michael', 'football', 'admin', 'welcome', 'login', 'user',
  'Password1', 'Password123', '12345', 'test', 'demo', 'changeme'
];

@ValidatorConstraint({ name: 'IsStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  private lastPassword: string;

  validate(password: string): boolean {
    this.lastPassword = password;
    
    if (!password || typeof password !== 'string') {
      return false;
    }

    // Mínimo 12 caracteres
    if (password.length < 12) {
      return false;
    }

    // Al menos una mayúscula
    if (!/[A-Z]/.test(password)) {
      return false;
    }

    // Al menos una minúscula
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Al menos un número
    if (!/\d/.test(password)) {
      return false;
    }

    // Al menos un símbolo especial
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    // No puede ser una contraseña común (case insensitive)
    const lowerPassword = password.toLowerCase();
    for (const common of COMMON_PASSWORDS) {
      if (lowerPassword.includes(common.toLowerCase())) {
        return false;
      }
    }

    // No puede tener más de 2 caracteres repetidos consecutivos (3 o más iguales seguidos)
    if (/(.)\1{2,}/.test(password)) {
      return false;
    }

    // No puede ser una secuencia simple (123456, abcdef, etc.)
    if (this.isSequential(password)) {
      return false;
    }

    return true;
  }

  private isSequential(str: string): boolean {
    const sequences = [
      '0123456789',
      'abcdefghijklmnopqrstuvwxyz',
      'qwertyuiopasdfghjklzxcvbnm',
    ];

    const lower = str.toLowerCase();
    
    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 4; i++) {
        const subseq = seq.substring(i, i + 4);
        if (lower.includes(subseq)) {
          return true;
        }
      }
    }

    return false;
  }

  defaultMessage(): string {
    if (!this.lastPassword) {
      return 'La contraseña debe tener al menos 12 caracteres y contener: mayúscula, minúscula, número y carácter especial';
    }

    const pwd = this.lastPassword;

    if (pwd.length < 12) {
      return 'La contraseña debe tener al menos 12 caracteres';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una letra mayúscula';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'La contraseña debe contener al menos una letra minúscula';
    }
    if (!/\d/.test(pwd)) {
      return 'La contraseña debe contener al menos un número';
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      return 'La contraseña debe contener al menos un carácter especial';
    }

    const lowerPassword = pwd.toLowerCase();
    for (const common of COMMON_PASSWORDS) {
      if (lowerPassword.includes(common.toLowerCase())) {
        return 'La contraseña no puede contener palabras comunes';
      }
    }

    if (/(..)\1{1,}/.test(pwd)) {
      return 'La contraseña no puede tener más de 2 caracteres repetidos consecutivos';
    }

    if (this.isSequential(pwd)) {
      return 'La contraseña no puede contener patrones secuenciales (abc, 123, qwerty)';
    }

    return 'La contraseña debe tener al menos 12 caracteres y contener: mayúscula, minúscula, número y carácter especial';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
