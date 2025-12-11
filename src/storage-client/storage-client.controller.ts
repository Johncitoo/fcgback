import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpStatus,
  BadRequestException,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import {
  StorageClientService,
  FileCategory,
  EntityType,
} from './storage-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/current-user.decorator';
import { FileValidator } from '../common/validators/file.validator';

class UploadFileDto {
  @IsEnum(FileCategory)
  category!: FileCategory;

  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  milestoneSubmissionId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('files')
export class StorageClientController {
  constructor(private readonly storageClient: StorageClientService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validar archivo según categoría
    const validationOptions = {
      category: this.getCategoryType(dto.category),
      maxSize: this.getMaxSizeForCategory(dto.category),
    };
    FileValidator.validate(file, validationOptions);

    // Get user UUID from the authenticated user
    // For now, we'll use a placeholder since we need to map integer ID to UUID
    // TODO: Update JWT to include UUID instead of integer ID
    const uploadedByUuid = '476d428e-a70a-4f88-b11a-6f59dc1a6f12'; // Temporary

    const response = await this.storageClient.upload(file, {
      category: dto.category,
      entityType: dto.entityType,
      entityId: dto.entityId,
      uploadedBy: uploadedByUuid,
      milestoneSubmissionId: dto.milestoneSubmissionId,
      description: dto.description,
    });

    // Storage service returns {success, file}, extract the file
    const metadata = (response as any).file || response;

    return {
      success: true,
      file: metadata,
      urls: {
        view: this.storageClient.getViewUrl(metadata.id),
        download: this.storageClient.getDownloadUrl(metadata.id),
        thumbnail: metadata.thumbnailUrl || (metadata.thumbnailPath
          ? this.storageClient.getThumbnailUrl(metadata.id)
          : null),
      },
    };
  }

  @Get(':id/download')
  async downloadFile(@Param('id') id: string, @Res() res: Response) {
    const metadata = await this.storageClient.getMetadata(id);
    const buffer = await this.storageClient.download(id);

    res.set({
      'Content-Type': metadata.mimetype,
      'Content-Disposition': `attachment; filename="${metadata.originalFilename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Get(':id/view')
  async viewFile(@Param('id') id: string, @Res() res: Response) {
    const metadata = await this.storageClient.getMetadata(id);
    const buffer = await this.storageClient.download(id);

    res.set({
      'Content-Type': metadata.mimetype,
      'Content-Disposition': `inline; filename="${metadata.originalFilename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.storageClient.getThumbnail(id);

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Get(':id/metadata')
  async getMetadata(@Param('id') id: string) {
    return this.storageClient.getMetadata(id);
  }

  @Get('list')
  @UseGuards(JwtAuthGuard)
  async listFiles(
    @Query('category') category?: FileCategory,
    @Query('entityType') entityType?: EntityType,
    @Query('entityId') entityId?: string,
    @Query('uploadedBy') uploadedBy?: string,
  ) {
    const files = await this.storageClient.list({
      category,
      entityType,
      entityId,
      uploadedBy,
    });

    return { files };
  }

  // Métodos helper para validación
  private getCategoryType(category: FileCategory): 'image' | 'document' | 'video' | 'all' {
    const categoryMap: Partial<Record<FileCategory, 'image' | 'document' | 'video' | 'all'>> = {
      'PROFILE': 'image',
      'DOCUMENT': 'document',
      'FORM_FIELD': 'all', // Permitir imágenes y documentos en campos de formulario
      'ATTACHMENT': 'all',
      'OTHER': 'all',
    };
    return categoryMap[category] || 'all';
  }

  private getMaxSizeForCategory(category: FileCategory): number {
    const sizeMap: Partial<Record<FileCategory, number>> = {
      'PROFILE': 5 * 1024 * 1024,         // 5 MB
      'DOCUMENT': 25 * 1024 * 1024,  // 25 MB
      'FORM_FIELD': 50 * 1024 * 1024,    // 50 MB
      'ATTACHMENT': 50 * 1024 * 1024,    // 50 MB
      'OTHER': 10 * 1024 * 1024,               // 10 MB
    };
    return sizeMap[category] || 10 * 1024 * 1024;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteFile(@Param('id') id: string) {
    await this.storageClient.delete(id);
    return { success: true, message: 'File deleted' };
  }
}
