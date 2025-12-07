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

  // ==== ENDPOINT PÚBLICO - Validar código de invitación ====
  @Post('validate-invite')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
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

  // ==== ENDPOINT PÚBLICO - Establecer contraseña ====
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

  // ==== DEV endpoints ====
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

  // ==== DEV ONLY - Establecer contraseña sin token (para desarrollo) ====
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
