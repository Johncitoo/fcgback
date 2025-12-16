import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ModerateDocumentDto } from './dto/moderate-document.dto';
import { AuthService } from '../auth/auth.service';
import { Roles } from '../auth/roles.decorator';

@Controller('documents')
@Roles('ADMIN', 'REVIEWER', 'APPLICANT')
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Sube un nuevo documento asociado a una aplicación.
   * Valida ownership para postulantes.
   * 
   * @param req - Request con token JWT
   * @param dto - DTO con datos del documento a subir
   * @returns Documento creado con metadata
   * 
   * @example
   * POST /api/documents/upload
   * Body: { "applicationId": "uuid", "type": "ID_CARD", "fileName": "cedula.pdf", ... }
   */
  @Post('upload')
  async upload(@Req() req: any, @Body() dto: UploadDocumentDto) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    const doc = await this.docs.upload(dto, u.sub, u.role);
    return { ok: true, document: doc };
  }

  /**
   * Lista todos los documentos de una aplicación.
   * Valida ownership para postulantes.
   * 
   * @param req - Request con token JWT
   * @param applicationId - ID de la aplicación
   * @returns Lista de documentos ordenada por fecha de creación
   * 
   * @example
   * GET /api/documents/uuid-123
   */
  @Get(':applicationId')
  async list(@Req() req: any, @Param('applicationId') applicationId: string) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    const items = await this.docs.listByApplication(
      applicationId,
      u.sub,
      u.role,
    );
    return { items };
  }

  /**
   * Elimina un documento por su ID.
   * Valida ownership para postulantes.
   * 
   * @param req - Request con token JWT
   * @param id - ID del documento
   * @returns Confirmación de eliminación
   * 
   * @example
   * DELETE /api/documents/uuid-123
   */
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    return this.docs.remove(id, u.sub, u.role);
  }

  /**
   * Modera un documento marcando su validez.
   * Solo accesible para ADMIN y REVIEWER.
   * 
   * @param req - Request con token JWT de staff
   * @param id - ID del documento
   * @param body - Estado de moderación y razón opcional
   * @returns Documento actualizado con estado de validación
   * @throws {ForbiddenException} Si no es staff
   * 
   * @example
   * POST /api/documents/uuid-123/moderate
   * Body: { "status": "VALID" }
   */
  @Post(':id/moderate')
  @Roles('ADMIN', 'REVIEWER')
  async moderate(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: ModerateDocumentDto,
  ) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    if (u.role !== 'ADMIN' && u.role !== 'REVIEWER') {
      throw new ForbiddenException('Staff only');
    }
    const updated = await this.docs.moderate(
      id,
      body.status,
      body.reason ?? null,
      u.sub,
    );
    return { ok: true, document: updated };
  }
}
