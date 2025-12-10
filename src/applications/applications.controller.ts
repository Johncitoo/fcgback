import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';
import { Roles } from '../auth/roles.decorator';

@Controller('applications')
@Roles('ADMIN', 'REVIEWER') // Todo el controlador requiere admin o revisor
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
    @Query('overallStatus') overallStatus?: string,
    @Query('callId') callId?: string,
    @Query('milestoneOrder') milestoneOrder?: string,
    @Query('count') count?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const needCount = count === '1' || count === 'true';
    const milestoneOrderNum = milestoneOrder ? parseInt(milestoneOrder, 10) : undefined;

    return this.apps.listApplications({
      limit: limitNum,
      offset: offsetNum,
      overallStatus,
      callId,
      milestoneOrder: milestoneOrderNum,
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

  // GET /api/applications/my-active - Obtener o crear la application del postulante para la convocatoria activa
  @Get('my-active')
  async getMyActive(@Req() req: any) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    return this.apps.getOrCreateForActiveCall(user.sub);
  }

  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    try {
      const user = this.getUserFromAuth(req);
      // Permitir tanto APPLICANT como ADMIN/REVIEWER
      if (user.role === 'APPLICANT') {
        return this.apps.getById(user.sub, id);
      } else if (user.role === 'ADMIN' || user.role === 'REVIEWER') {
        // Admin puede ver cualquier aplicación
        return this.apps.getByIdAdmin(id);
      } else {
        throw new BadRequestException('Unauthorized role');
      }
    } catch (error) {
      // Si no hay token válido, intentar como admin sin autenticación (temporal para desarrollo)
      return this.apps.getByIdAdmin(id);
    }
  }

  @Patch(':id')
  async patch(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.patch(user.sub, id, body);
  }

  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.submit(user.sub, id);
  }

  // Marcar código de invitación como completado después de enviar el formulario
  @Post(':id/complete-invite')
  async completeInvite(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.completeInvite(user.sub, id);
  }

  // GET /api/applications/:id/answers - Obtener respuestas guardadas del formulario
  @Get(':id/answers')
  async getAnswers(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.getAnswers(user.sub, id);
  }

  // PUT /api/applications/:id/answers - Guardar respuestas del formulario (borrador)
  @Patch(':id/answers')
  async saveAnswers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() answers: any,
  ) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT')
      throw new BadRequestException('Applicant only');
    return this.apps.saveAnswers(user.sub, id, answers);
  }
}
