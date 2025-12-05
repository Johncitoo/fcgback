import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Controller('users')
export class UserAuthController {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private cfg: ConfigService,
  ) {}

  // POST /api/users/change-password
  @Post('change-password')
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
    const hash = await argon2.hash(body.newPassword, { type: argon2.argon2id });

    // Actualizar contraseña
    await this.users.updatePassword(userId, hash);

    return {
      success: true,
      message: 'Contraseña actualizada exitosamente',
    };
  }
}
