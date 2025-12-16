import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

/**
 * Guard para validar roles de usuario en endpoints protegidos.
 * 
 * Verifica que el usuario autenticado tenga uno de los roles requeridos
 * especificados en el decorador @Roles().
 * 
 * Flujo de autorización:
 * 1. Lee metadata de @Roles() del endpoint o controlador
 * 2. Si no hay roles requeridos, permite acceso (endpoint sin restricción de rol)
 * 3. Extrae user de req.user (inyectado previamente por JwtAuthGuard)
 * 4. Verifica si user.role coincide con alguno de los roles requeridos
 * 5. Si coincide, permite acceso; si no, lanza ForbiddenException
 * 
 * Debe aplicarse DESPUÉS de JwtAuthGuard en la cadena de guards.
 * 
 * @implements {CanActivate}
 * @throws {ForbiddenException} Si el usuario no tiene el rol requerido
 * @throws {ForbiddenException} Si req.user no existe (no pasó por JwtAuthGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);
    
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
