import { Body, Controller, Ip, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { ValidateInviteDto } from './dto/validate-invite.dto';
import { IssuePasswordLinkDto } from './dto/issue-password-link.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { LoginApplicantDto } from './dto/login-applicant.dto';
import { DevCreateInviteDto } from './dto/dev-create-invite.dto';

@Controller('onboarding')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // ==== DEV endpoints ====
  @Post('dev/create-invite')
  async devCreateInvite(@Body() dto: DevCreateInviteDto, @Req() req: any, @Ip() ip: string) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    return this.onboarding.devCreateInvite(dto.callId, dto.code, dto.ttlDays, dto.institutionId, undefined);
  }

  // ==== público del flujo de onboarding ====
  @Post('validate-invite')
  async validateInvite(@Body() dto: ValidateInviteDto) {
    return this.onboarding.validateInvite(dto.code, dto.callId);
  }

  @Post('issue-password-link')
  async issuePasswordLink(@Body() dto: IssuePasswordLinkDto, @Req() req: any, @Ip() ip: string) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    return this.onboarding.issuePasswordLink(dto.code, dto.callId, dto.email, dto.fullName, ip, ua);
  }

  @Post('set-password')
  async setPassword(@Body() dto: SetPasswordDto, @Req() req: any, @Ip() ip: string) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    return this.onboarding.setPassword(dto.token, dto.password, ip, ua);
  }

  @Post('login/applicant')
  async loginApplicant(@Body() dto: LoginApplicantDto, @Req() req: any, @Ip() ip: string) {
    const ua = req?.headers?.['user-agent'] as string | undefined;
    return this.onboarding.loginApplicant(dto.email, dto.password, ip, ua);
  }
}
