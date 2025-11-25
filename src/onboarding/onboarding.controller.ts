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
  async validateInvite(@Body() dto: ValidateInvitePublicDto) {
    const result = await this.onboarding.validateInviteCode(dto.code, dto.email);
    
    return {
      success: true,
      message: result.isNewUser 
        ? 'Código validado exitosamente. Hemos creado tu cuenta y enviado un email para establecer tu contraseña.'
        : 'Bienvenido de vuelta. Puedes continuar con tu postulación.',
      applicationId: result.applicationId,
      userId: result.user.id,
      // NO enviamos el passwordToken aquí por seguridad, se envía por email
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
}
