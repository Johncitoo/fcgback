import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Roles } from '../auth/roles.decorator';

/**
 * Controller para operaciones de autenticación de usuarios.
 * 
 * Proporciona endpoints para cambio de contraseña de usuarios autenticados.
 * Accesible por todos los roles autenticados (ADMIN, REVIEWER, APPLICANT).
 * 
 * @path /users
 * @roles ADMIN, REVIEWER, APPLICANT
 */
@ApiTags('User Auth')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@Roles('ADMIN', 'REVIEWER', 'APPLICANT')
export class UserAuthController {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  /**
   * Permite al usuario autenticado cambiar su contraseña.
   * 
   * Valida el token JWT, verifica requisitos de seguridad de la nueva contraseña,
   * la hashea con bcrypt y actualiza en la BD.
   * 
   * @param req - Request con token JWT en header Authorization
   * @param body - Nueva contraseña (mínimo 6 caracteres)
   * @param body.newPassword - Nueva contraseña a establecer
   * @returns Confirmación de cambio exitoso
   * @throws {UnauthorizedException} Si el token es inválido o no está presente
   * @throws {BadRequestException} Si la contraseña no cumple requisitos mínimos
   * 
   * @example
   * POST /api/users/change-password
   * Authorization: Bearer <token>
   * Body: { "newPassword": "NewSecurePass123!" }
   * Response: { "success": true, "message": "Contraseña actualizada exitosamente" }
   */
  // POST /api/users/change-password
  @Post('change-password')
  @ApiOperation({ summary: 'Cambiar contraseña', description: 'Cambia la contraseña del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  @ApiResponse({ status: 400, description: 'Contraseña no cumple requisitos' })
  async changePassword(
    @Req() req: any,
    @Body() body: { newPassword: string },
  ) {
    // Extraer token del header
    const authHeader = req.headers?.authorization ?? '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    // Verificar token
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET');
    if (!secret) {
      throw new Error('JWT secret no configurado');
    }

    let payload: any;
    try {
      payload = this.jwt.verify(token, { secret });
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const userId = payload.sub;
    if (!userId) {
      throw new UnauthorizedException('Token sin información de usuario');
    }

    // Validar nueva contraseña
    if (!body.newPassword || body.newPassword.length < 6) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );
    }

    // Hashear nueva contraseña
    const hash = await bcrypt.hash(body.newPassword, 10);

    // Actualizar contraseña
    await this.users.updatePassword(userId, hash);

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    };
  }
}
