import { SetMetadata } from '@nestjs/common';

/**
 * Clave de metadata para almacenar roles requeridos.
 * Utilizada por RolesGuard para verificar acceso.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador para restringir acceso a endpoints por rol de usuario.
 * 
 * Aplica a nivel de controlador (todos los métodos) o método individual.
 * Los roles son validados por RolesGuard que compara con req.user.role.
 * 
 * Roles disponibles:
 * - ADMIN: Acceso completo al sistema
 * - REVIEWER: Revisión de aplicaciones y gestión de convocatorias
 * - APPLICANT: Postulantes, acceso limitado a sus propios datos
 * 
 * @param roles - Lista de roles permitidos para el endpoint
 * @returns Decorador de metadata de NestJS
 * 
 * @example
 * // Nivel de controlador
 * @Controller('admin')
 * @Roles('ADMIN', 'REVIEWER')
 * export class AdminController {}
 * 
 * @example
 * // Nivel de método
 * @Get('profile')
 * @Roles('APPLICANT')
 * async getProfile() {}
 */
export const Roles = (...roles: ('ADMIN' | 'REVIEWER' | 'APPLICANT')[]) =>
  SetMetadata(ROLES_KEY, roles);
