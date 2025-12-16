import { SetMetadata } from '@nestjs/common';

/**
 * Clave de metadata para marcar endpoints públicos.
 * Utilizada por JwtAuthGuard para permitir acceso sin autenticación.
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorador para marcar endpoints como públicos (sin autenticación requerida).
 * 
 * Por defecto, todos los endpoints están protegidos por JwtAuthGuard.
 * Este decorador permite bypasear la autenticación JWT para endpoints
 * que deben ser accesibles sin login.
 * 
 * Casos de uso comunes:
 * - Login/registro de usuarios
 * - Validación de códigos de invitación
 * - Recuperación de contraseña
 * - Health checks y endpoints de monitoreo
 * - Formularios públicos de convocatorias OPEN
 * 
 * @returns Decorador de metadata de NestJS
 * 
 * @example
 * @Public()
 * @Post('login')
 * async login(@Body() dto: LoginDto) {}
 * 
 * @example
 * @Controller('public')
 * @Public()
 * export class PublicController {} // Todos los métodos son públicos
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
