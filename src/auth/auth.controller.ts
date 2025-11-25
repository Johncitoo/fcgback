import { Body, Controller, HttpCode, Ip, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { ValidateInviteDto } from './dto/validate-invite.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Cambiar a login-staff (sin la barra)
  @Post('login-staff')
  @HttpCode(200)
  async loginStaff(@Body() dto: LoginStaffDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.loginStaff(dto.email, dto.password, ip, ua);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: any) {
    const ua = req?.headers?.['user-agent'] ?? undefined;
    return this.auth.refresh(dto.refreshToken, ip, ua);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto) {
    return this.auth.logout(dto.refreshToken);
  }

  // Login con código de invitación
  @Post('enter-invite')
  @HttpCode(200)
  async enterInvite(@Body() dto: ValidateInviteDto, @Req() req: any) {
    const ip = req.ip;
    const ua = req.headers?.['user-agent'];
    return this.auth.validateInviteCode(dto.code, ip, ua);
  }

  // ====== SOLO DEV / SEMILLA (protegido por env) ======
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
