import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProfileService } from './profile.service';
import { Roles } from '../auth/roles.decorator';

@Controller('profile') // <-- sin /api
@Roles('APPLICANT')
export class ProfileController {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private prof: ProfileService,
  ) {}

  private getUserFromAuth(req: any) {
    const hdr = req.headers?.authorization ?? '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) throw new Error('Missing bearer token');

    try {
      const payload = this.jwt.verify(token, {
        secret: this.cfg.get<string>('AUTH_JWT_SECRET')!,
        ignoreExpiration: false,
      });
      return payload as { sub: string; role: string; typ: string };
    } catch (e) {
      console.error('JWT verification failed:', e.message);
      throw new Error('Invalid token');
    }
  }

  @Post('applicant')
  async ensureApplicant(@Req() req: any, @Body() body: any) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    return this.prof.ensureApplicant(user.sub, body);
  }
}
