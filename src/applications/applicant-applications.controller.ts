import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Delete,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApplicationsService } from './applications.service';
import { Roles } from '../auth/roles.decorator';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { SaveAnswersDto } from './dto/save-answers.dto';

@Controller('applications')
@Roles('APPLICANT') // Endpoints para postulantes
export class ApplicantApplicationsController {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private apps: ApplicationsService,
  ) {}

  /**
   * Extrae y valida el usuario desde el token JWT.
   */
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

  /**
   * POST /api/applications
   * Obtiene una aplicación existente o crea una nueva para el postulante.
   */
  @Post()
  async getOrCreate(@Req() req: any, @Body() body: { callId: string }) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    if (!body?.callId) throw new BadRequestException('callId required');
    return this.apps.getOrCreate(user.sub, body.callId);
  }

  /**
   * GET /api/applications/my-active
   * Obtiene o crea la aplicación del postulante para la convocatoria activa.
   */
  @Get('my-active')
  async getMyActive(@Req() req: any) {
    const user = this.getUserFromAuth(req);
    if (user.typ !== 'access' || user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access token required');
    }
    return this.apps.getOrCreateForActiveCall(user.sub);
  }

  /**
   * GET /api/applications/:id
   * Obtiene los detalles de una aplicación específica del postulante.
   */
  @Get(':id')
  async getById(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access required');
    }
    return this.apps.getById(user.sub, id);
  }

  /**
   * PATCH /api/applications/:id
   * Actualiza una aplicación del postulante.
   */
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
  ) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access required');
    }
    return this.apps.update(id, dto);
  }

  /**
   * POST /api/applications/:id/submit
   * Envía la aplicación del postulante.
   */
  @Post(':id/submit')
  async submit(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access required');
    }
    return this.apps.submitApplication(id, user.sub);
  }

  /**
   * PATCH /api/applications/:id/answers
   * Guarda respuestas de formulario del postulante.
   */
  @Patch(':id/answers')
  async saveAnswers(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SaveAnswersDto,
  ) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access required');
    }
    return this.apps.saveAnswers(id, dto);
  }

  /**
   * GET /api/applications/:id/answers
   * Obtiene las respuestas guardadas del postulante.
   */
  @Get(':id/answers')
  async getAnswers(@Req() req: any, @Param('id') id: string) {
    const user = this.getUserFromAuth(req);
    if (user.role !== 'APPLICANT') {
      throw new BadRequestException('Applicant access required');
    }
    return this.apps.getAnswers(id);
  }
}
