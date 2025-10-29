import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ModerateDocumentDto } from './dto/moderate-document.dto';
import { AuthService } from '../auth/auth.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly auth: AuthService,
  ) {}

  @Post('upload')
  async upload(@Req() req: any, @Body() dto: UploadDocumentDto) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    const doc = await this.docs.upload(dto, u.sub, u.role);
    return { ok: true, document: doc };
  }

  @Get(':applicationId')
  async list(@Req() req: any, @Param('applicationId') applicationId: string) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    const items = await this.docs.listByApplication(applicationId, u.sub, u.role);
    return { items };
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    return this.docs.remove(id, u.sub, u.role);
  }

  // ===== Moderación Staff =====
  @Post(':id/moderate')
  async moderate(@Req() req: any, @Param('id') id: string, @Body() body: ModerateDocumentDto) {
    const u = this.auth.getUserFromAuthHeader(req.headers?.authorization);
    if (u.role !== 'ADMIN' && u.role !== 'REVIEWER') {
      throw new ForbiddenException('Staff only');
    }
    const updated = await this.docs.moderate(id, body.status, body.reason ?? null, u.sub);
    return { ok: true, document: updated };
  }
}
