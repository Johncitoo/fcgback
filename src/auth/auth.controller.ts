import { Body, Controller, HttpCode, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ValidateInviteDto } from './dto/validate-invite.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Cambiar a login-staff (sin la barra)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @Post('login-staff')
  @HttpCode(200)
  async loginStaff(@Body() dto: LoginStaffDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.loginStaff(dto.email, dto.password, ip, ua);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: any) {
    const ua = req?.headers?.['user-agent'] ?? undefined;
    return this.auth.refresh(dto.refreshToken, ip, ua);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // Login con código de invitación (LEGACY - se recomienda usar /onboarding/validate-invite)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @Post('enter-invite')
  @HttpCode(200)
  async enterInvite(@Body() dto: ValidateInviteDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.validateInviteCode(dto.code, dto.email, ip, ua);
  }

  // Login normal para postulantes (email + password)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto
  @Post('login')
  @HttpCode(200)
  async loginApplicant(
    @Body() dto: { email: string; password: string },
    @Req() req: any,
  ) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.loginApplicant(dto.email, dto.password, ip, ua);
  }

  // Solicitar recuperación de contraseña
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 intentos por minuto
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: { email: string }) {
    return this.auth.forgotPassword(dto.email);
  }

  // Restablecer contraseña con token
  @Public()
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: { token: string; newPassword: string }) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  // ====== SOLO DEV / SEMILLA (protegido por env) ======
  @Public()
  @Post('dev/seed-staff')
  @HttpCode(200)
  devSeed(
    @Body()
    body: {
      email: string;
      fullName: string;
      role: 'ADMIN' | 'REVIEWER';
      password: string;
    },
  ) {
    return this.auth.devSeedStaff(
      body.email,
      body.fullName,
      body.role,
      body.password,
    );
  }
}
