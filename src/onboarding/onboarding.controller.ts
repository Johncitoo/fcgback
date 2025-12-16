import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
  HttpCode,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OnboardingService } from './onboarding.service';
import { DevCreateInviteDto } from './dto/dev-create-invite.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ValidateInvitePublicDto } from './dto/validate-invite-public.dto';
import { Public } from '../auth/public.decorator';

@Controller('onboarding')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /**
   * Valida un código de invitación y genera token para establecer contraseña.
   * Endpoint público con rate limiting (5 intentos por minuto).
   * 
   * @param dto - Código de invitación y email opcional
   * @returns Información del usuario y token para establecer contraseña (válido 10 min)
   * @throws {BadRequestException} Si el código es inválido o expiró
   * 
   * @example
   * POST /api/onboarding/validate-invite
   * Body: { "code": "ABC123", "email": "user@example.com" }
   * Response: { "success": true, "passwordToken": "token123", "userId": "uuid" }
   */
  @Public()
  @Post('validate-invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async validateInvite(@Body() dto: ValidateInvitePublicDto) {
    const result = await this.onboarding.validateInviteCode(dto.code, dto.email || '');
    
    return {
      success: true,
      email: result.user.email,
      passwordToken: result.passwordToken, // Devolver token para setear contraseña inmediatamente
      tokenExpiresIn: 600, // 10 minutos en segundos
      message: result.isNewUser 
        ? 'Código validado exitosamente. Ahora crea tu contraseña para acceder.'
        : 'Bienvenido de vuelta. Ahora crea tu contraseña para acceder.',
      applicationId: result.applicationId,
      userId: result.user.id,
      userName: result.user.fullName,
    };
  }

  /**
   * Establece la contraseña del usuario usando el token de invitación.
   * Endpoint público. Token válido por 10 minutos.
   * 
   * @param dto - Token de invitación y nueva contraseña
   * @param req - Request para obtener user agent
   * @param ip - IP del cliente
   * @returns Confirmación y userId
   * @throws {BadRequestException} Si el token es inválido o expiró
   * 
   * @example
   * POST /api/onboarding/set-password
   * Body: { "token": "token123", "password": "SecurePass123!" }
   */
  @Public()
  @Post('set-password')
  @HttpCode(200)
  async setPassword(
    @Body() dto: SetPasswordDto,
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    const user = await this.onboarding.setPasswordWithToken(
      dto.token,
      dto.password,
      ip,
      ua,
    );
    return { 
      success: true, 
      userId: user.id,
      message: 'Contraseña establecida exitosamente. Ahora puedes iniciar sesión.',
    };
  }

  /**
   * Crea un código de invitación para desarrollo.
   * Endpoint público solo para desarrollo/testing.
   * 
   * @param dto - CallId, código personalizado, TTL en días e institutionId opcional
   * @returns Código de invitación creado
   * 
   * @example
   * POST /api/onboarding/dev/create-invite
   * Body: { "callId": "uuid", "code": "TEST123", "ttlDays": 30 }
   */
  @Public()
  @Post('dev/create-invite')
  async devCreateInvite(
    @Body() dto: DevCreateInviteDto,
  ) {
    return this.onboarding.devCreateInvite(
      dto.callId,
      dto.code,
      dto.ttlDays,
      dto.institutionId,
    );
  }

  /**
   * Establece contraseña directamente por email sin token.
   * Endpoint público solo para desarrollo/testing.
   * 
   * @param body - Email y nueva contraseña
   * @param req - Request para obtener user agent
   * @param ip - IP del cliente
   * @returns Confirmación y userId
   * 
   * @example
   * POST /api/onboarding/dev/set-password
   * Body: { "email": "test@example.com", "password": "SecurePass123!" }
   */
  @Public()
  @Post('dev/set-password')
  @HttpCode(200)
  async devSetPassword(
    @Body() body: { email: string; password: string },
    @Req() req: any,
    @Ip() ip: string,
  ) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    const user = await this.onboarding.devSetPasswordByEmail(
      body.email,
      body.password,
      ip,
      ua,
    );
    return { 
      success: true, 
      userId: user.id,
      message: 'Contraseña establecida exitosamente. Ahora puedes iniciar sesión.',
    };
  }
}
