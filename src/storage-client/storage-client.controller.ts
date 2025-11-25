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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { Response } from 'express';
import {
  StorageClientService,
  FileCategory,
  EntityType,
} from './storage-client.service';

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
  description?: string;

  @IsUUID()
  uploadedBy!: string;
}

@Controller('files')
export class StorageClientController {
  constructor(private readonly storageClient: StorageClientService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const metadata = await this.storageClient.upload(file, {
      category: dto.category,
      entityType: dto.entityType,
      entityId: dto.entityId,
      uploadedBy: dto.uploadedBy,
      description: dto.description,
    });

    return {
      success: true,
      file: metadata,
      urls: {
        view: this.storageClient.getViewUrl(metadata.id),
        download: this.storageClient.getDownloadUrl(metadata.id),
        thumbnail: metadata.thumbnailPath
          ? this.storageClient.getThumbnailUrl(metadata.id)
          : null,
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

  @Delete(':id')
  async deleteFile(@Param('id') id: string) {
    await this.storageClient.delete(id);
    return { success: true, message: 'File deleted' };
  }
}
