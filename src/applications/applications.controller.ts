import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';

@Controller('applications')
export class ApplicationsController {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private apps: ApplicationsService,
  ) {}

  private getUserFromAuth(req: any) {
    const hdr = (req.headers?.authorization ?? '') as string;
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) throw new BadRequestException('Missing bearer token');
    const secret = this.cfg.get<string>('AUTH_JWT_SECRET')!;
    const payload = this.jwt.verify(token, {
      secret,
      audience: this.cfg.get<string>('AUTH_JWT_AUD'),
      issuer: this.cfg.get<string>('AUTH_JWT_ISS'),
    });
    return payload as { sub: string; role: string; typ: string };
  }

  // GET /api/applications - Lista administrativa de aplicaciones
  @Get()
  async listAdmin(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('callId') callId?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';

    return this.apps.listApplications({
      limit: limitNum,
      offset: offsetNum,
      status,
      callId,
      needCount,
    });
  }

  @Post()
  async getOrCreate(@Req() req: any, @Body() body: { callId: string }) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    if (!body?.callId) throw new BadRequestException('callId required');
    return this.apps.getOrCreate(user.sub, body.callId);
  }

  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') throw new BadRequestException('Applicant only');
    return this.apps.getById(user.sub, id);
  }

  @Patch(':id')
  async patch(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') throw new BadRequestException('Applicant only');
    return this.apps.patch(user.sub, id, body);
  }

  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') throw new BadRequestException('Applicant only');
    return this.apps.submit(user.sub, id);
  }
}
