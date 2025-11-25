import {
  Body,
  Controller,
  Ip,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { DevCreateInviteDto } from './dto/dev-create-invite.dto';
import { SetPasswordDto } from './dto/set-password.dto';

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

  @Post('set-password')
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
    return { success: true, userId: user.id };
  }
}
