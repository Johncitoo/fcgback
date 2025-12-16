import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Guard para validar tokens JWT en requests.
 * 
 * Protege todos los endpoints por defecto, excepto los marcados con @Public().
 * 
 * Flujo de validación:
 * 1. Verifica si el endpoint tiene decorador @Public() → permite acceso
 * 2. Extrae token del header Authorization (Bearer <token>)
 * 3. Valida el token con JwtService y AUTH_JWT_SECRET
 * 4. Si es válido, inyecta payload en req.user y permite acceso
 * 5. Si es inválido o no existe, lanza UnauthorizedException
 * 
 * El payload decodificado incluye: sub (userId), email, role, iat, exp
 * 
 * @implements {CanActivate}
 * @throws {UnauthorizedException} Si no hay token o el token es inválido/expirado
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if endpoint is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('AUTH_JWT_SECRET'),
      });
      
      // Attach user info to request
      request['user'] = payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
    
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
