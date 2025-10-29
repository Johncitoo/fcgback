import { Body, Controller, HttpCode, Ip, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login/staff')
  @HttpCode(200)
  loginStaff(@Body() dto: LoginStaffDto, @Ip() ip: string, @Req() req: any) {
    const ua = req?.headers?.['user-agent'] ?? undefined;
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

  // ====== SOLO DEV / SEMILLA (protegido por env) ======
  @Post('dev/seed-staff')
  @HttpCode(200)
  devSeed(@Body() body: { email: string; fullName: string; role: 'ADMIN' | 'REVIEWER'; password: string }) {
    return this.auth.devSeedStaff(body.email, body.fullName, body.role, body.password);
  }
}
