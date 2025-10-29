import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Document, ValidationStatus } from './documents.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ModerateStatus } from './dto/moderate-document.dto';
import * as crypto from 'crypto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly repo: Repository<Document>,
    private readonly ds: DataSource,
  ) {}

  /** Ownership: mapea user.id -> users.applicant_id y compara contra applications.applicant_id */
  async assertApplicantOwnsApplication(applicationId: string, userId: string) {
    const rows = await this.ds.query(
      `
      SELECT 1
        FROM applications a
        JOIN users u ON u.applicant_id = a.applicant_id
       WHERE a.id = $1
         AND u.id = $2
       LIMIT 1
      `,
      [applicationId, userId],
    );
    if (rows.length === 0) {
      throw new ForbiddenException('Application does not belong to this user');
    }
  }

  /** Alta + versionado */
  async upload(dto: UploadDocumentDto, userId: string, userRole: string) {
    if (userRole === 'APPLICANT') {
      await this.assertApplicantOwnsApplication(dto.applicationId, userId);
    }

    const prev = await this.repo.findOne({
      where: { applicationId: dto.applicationId, fileName: dto.fileName, isCurrent: true },
      select: ['id', 'version'],
    });
    const nextVersion = (prev?.version ?? 0) + 1;

    if (prev) {
      await this.repo.update(prev.id, { isCurrent: false });
    }

    const contentType = dto.mimeType;
    const sizeBytes = dto.sizeKb * 1024;
    const storageKey = `applications/${dto.applicationId}/${Date.now()}_${dto.fileName}`;
    const checksum = crypto
      .createHash('sha256')
      .update(`${dto.fileName}:${sizeBytes}:${storageKey}`)
      .digest('hex');

    const doc = this.repo.create({
      applicationId: dto.applicationId,
      type: dto.type,
      fileName: dto.fileName,
      storageKey,
      contentType,
      sizeBytes,
      checksum,
      validationStatus: ValidationStatus.PENDING,
      invalidReason: null,
      validatedBy: null,
      validatedAt: null,
      version: nextVersion,
      isCurrent: true,
      formFieldId: null,
    });

    await this.repo.save(doc);
    return doc;
  }

  async listByApplication(applicationId: string, userId: string, userRole: string) {
    if (userRole === 'APPLICANT') {
      await this.assertApplicantOwnsApplication(applicationId, userId);
    }
    return this.repo.find({
      where: { applicationId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    if (userRole === 'APPLICANT') {
      const doc = await this.repo.findOne({ where: { id } });
      if (!doc) return { ok: true };
      await this.assertApplicantOwnsApplication(doc.applicationId, userId);
    }
    await this.repo.delete(id);
    return { ok: true };
  }

  /** Moderación Staff */
  async moderate(id: string, status: ModerateStatus, reason: string | null, actorUserId: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) return { ok: true };

    const now = new Date();

    if (status === ModerateStatus.VALID) {
      await this.repo.update(id, {
        validationStatus: ValidationStatus.VALID,
        invalidReason: null,
        validatedBy: actorUserId,
        validatedAt: now,
      });
    } else {
      await this.repo.update(id, {
        validationStatus: ValidationStatus.INVALID,
        invalidReason: reason ?? 'Rejected',
        validatedBy: actorUserId,
        validatedAt: now,
      });
    }

    return this.repo.findOne({ where: { id } });
  }
}
