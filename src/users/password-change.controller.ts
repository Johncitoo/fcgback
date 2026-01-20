import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PasswordChangeService } from './password-change.service';

class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

/**
 * Controlador para cambio de contraseña con token por email.
 * 
 * Flujo seguro:
 * 1. Usuario autenticado solicita cambio (/request)
 * 2. Se envía email con token de un solo uso
 * 3. Usuario valida token (/validate/:token)
 * 4. Usuario envía nueva contraseña con token (/change)
 * 
 * @path /auth/password-change
 */
@ApiTags('Password Change')
@Controller('auth/password-change')
export class PasswordChangeController {
  private readonly logger = new Logger(PasswordChangeController.name);

  constructor(private readonly passwordChangeService: PasswordChangeService) {}

  @Post('request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Solicitar cambio', description: 'Envía email con link para cambio de contraseña' })
  @ApiResponse({ status: 200, description: 'Email enviado' })
  async requestPasswordChange(@Request() req) {
    const userId = req.user?.sub;

    if (!userId) {
      throw new Error('User ID no encontrado en token JWT');
    }

    this.logger.log(`Usuario ${userId} solicita cambio de contraseña`);

    await this.passwordChangeService.requestPasswordChange(userId);

    return {
      success: true,
      message: 'Se ha enviado un enlace a tu correo electrónico para cambiar tu contraseña',
    };
  }

  @Get('validate/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validar token', description: 'Valida que el token de cambio sea válido' })
  @ApiParam({ name: 'token', description: 'Token recibido por email' })
  @ApiResponse({ status: 200, description: 'Token válido' })
  @ApiResponse({ status: 400, description: 'Token inválido o expirado' })
  async validateToken(@Param('token') token: string) {
    this.logger.log(`Validando token de cambio de contraseña`);

    const validation = await this.passwordChangeService.validateToken(token);

    return validation;
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Body() dto: ChangePasswordDto) {
    this.logger.log(`Cambiando contraseña con token`);

    await this.passwordChangeService.changePasswordWithToken(
      dto.token,
      dto.newPassword,
    );

    return {
      success: true,
      message: 'Tu contraseña ha sido cambiada exitosamente',
    };
  }

  @Get('validate/:token')
  @HttpCode(HttpStatus.OK)
  async validateChangeToken(@Param('token') token: string) {
    this.logger.log(`Validando token de cambio de contraseña desde password-change`);

    const validation = await this.passwordChangeService.validateToken(token);

    return validation;
  }
}
