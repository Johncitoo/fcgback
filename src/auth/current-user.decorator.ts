import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Interfaz del payload JWT del usuario autenticado.
 * 
 * Contiene la información decodificada del token JWT.
 * Inyectada en req.user por JwtAuthGuard.
 */
export interface JwtPayload {
  /** ID del usuario (UUID) */
  sub: number;
  /** Email del usuario */
  email: string;
  /** Rol del usuario: ADMIN, REVIEWER o APPLICANT */
  role: string;
  /** Timestamp de emisión del token (issued at) */
  iat?: number;
  /** Timestamp de expiración del token */
  exp?: number;
}

/**
 * Decorador de parámetro para inyectar el usuario autenticado.
 * 
 * Extrae req.user (inyectado por JwtAuthGuard) y lo hace disponible
 * como parámetro del método del controlador.
 * 
 * Puede usarse para obtener el objeto completo o una propiedad específica.
 * 
 * @param data - Clave opcional de JwtPayload para extraer solo un campo
 * @returns Usuario autenticado completo o campo específico
 * 
 * @example
 * // Obtener usuario completo
 * @Get('profile')
 * async getProfile(@CurrentUser() user: JwtPayload) {
 *   console.log(user.sub, user.role);
 * }
 * 
 * @example
 * // Obtener solo un campo
 * @Get('my-data')
 * async getMyData(@CurrentUser('sub') userId: number) {
 *   return this.service.findById(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
