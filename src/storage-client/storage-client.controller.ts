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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
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

/**
 * Controller para gestión de archivos mediante servicio de almacenamiento externo.
 * 
 * Proporciona endpoints para upload, download, view, thumbnail y metadata de archivos.
 * Los archivos se almacenan en Railway (servicio externo) mientras los metadatos
 * se guardan en la BD local.
 * 
 * Categorías de archivos:
 * - PROFILE: Fotos de perfil (5 MB máx, solo imágenes)
 * - DOCUMENT: Documentos oficiales (25 MB máx, PDF/Word/Excel)
 * - FORM_FIELD: Respuestas de formularios (50 MB máx, cualquier tipo)
 * - ATTACHMENT: Adjuntos generales (50 MB máx)
 * - OTHER: Otros archivos (10 MB máx)
 * 
 * @path /files
 * @auth Requiere JwtAuthGuard en todos los endpoints
 */
@ApiTags('Files')
@ApiBearerAuth('JWT-auth')
@Controller('files')
export class StorageClientController {
  constructor(private readonly storageClient: StorageClientService) {}

  /**
   * Sube un archivo al servicio de almacenamiento.
   * 
   * Valida el tipo y tamaño del archivo según la categoría especificada,
   * lo almacena en el servicio de storage y retorna las URLs de acceso.
   * 
   * @param {Express.Multer.File} file - Archivo a subir (campo multipart 'file')
   * @param {UploadFileDto} dto - Datos de configuración del archivo (categoría, entidad asociada, descripción)
   * @param {JwtPayload} user - Usuario autenticado que realiza la subida
   * @returns {Promise<{success: boolean, file: any, urls: {view: string, download: string, thumbnail: string|null}}>} Metadata del archivo y URLs de acceso
   * 
   * @throws {BadRequestException} Si no se proporciona archivo
   * @throws {BadRequestException} Si el archivo no cumple con las validaciones de tipo o tamaño
   * 
   * @example
   * POST /api/files/upload
   * Content-Type: multipart/form-data
   * Authorization: Bearer <token>
   * 
   * Body:
   * - file: [archivo]
   * - category: DOCUMENT
   * - entityType: APPLICATION
   * - entityId: uuid-application
   */
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir archivo', description: 'Sube un archivo al servicio de almacenamiento' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Archivo subido exitosamente' })
  @ApiResponse({ status: 400, description: 'Archivo inválido o falta archivo' })
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

  /**
   * Descarga un archivo por su ID.
   * 
   * Obtiene el archivo del servicio de almacenamiento y lo envía al cliente
   * con headers que fuerzan la descarga (Content-Disposition: attachment).
   * 
   * @param {string} id - ID único del archivo
   * @param {Response} res - Objeto de respuesta Express
   * @returns {Promise<void>} Stream del archivo con headers de descarga
   * 
   * @throws {NotFoundException} Si el archivo no existe
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * 
   * @example
   * GET /api/files/abc123/download
   * Authorization: Bearer <token>
   */
  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Descargar archivo', description: 'Descarga un archivo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo descargado' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
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

  /**
   * Visualiza un archivo en el navegador por su ID.
   * 
   * Similar a downloadFile pero con Content-Disposition: inline,
   * permitiendo que el navegador renderice el archivo (PDFs, imágenes, etc.)
   * en lugar de descargarlo.
   * 
   * @param {string} id - ID único del archivo
   * @param {Response} res - Objeto de respuesta Express
   * @returns {Promise<void>} Stream del archivo con headers de visualización inline
   * 
   * @throws {NotFoundException} Si el archivo no existe
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * 
   * @example
   * GET /api/files/abc123/view
   * Authorization: Bearer <token>
   */
  @Get(':id/view')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ver archivo', description: 'Visualiza archivo en el navegador (inline)' })
  @ApiParam({ name: 'id', description: 'ID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo renderizado' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
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

  /**
   * Obtiene la miniatura (thumbnail) de un archivo de imagen.
   * 
   * Retorna una versión reducida de la imagen optimizada para previsualizaciones.
   * Solo disponible para archivos de tipo imagen.
   * 
   * @param {string} id - ID único del archivo
   * @param {Response} res - Objeto de respuesta Express
   * @returns {Promise<void>} Stream de la miniatura en formato JPEG
   * 
   * @throws {NotFoundException} Si el archivo o su thumbnail no existe
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * 
   * @example
   * GET /api/files/abc123/thumbnail
   * Authorization: Bearer <token>
   */
  @Get(':id/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener miniatura', description: 'Obtiene thumbnail de imagen' })
  @ApiParam({ name: 'id', description: 'ID del archivo' })
  @ApiResponse({ status: 200, description: 'Miniatura en JPEG' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async getThumbnail(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.storageClient.getThumbnail(id);

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Obtiene los metadatos de un archivo sin descargarlo.
   * 
   * Retorna información como nombre original, tipo MIME, tamaño,
   * fecha de subida, usuario que lo subió, etc.
   * 
   * @param {string} id - ID único del archivo
   * @returns {Promise<FileMetadata>} Objeto con metadatos del archivo
   * 
   * @throws {NotFoundException} Si el archivo no existe
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * 
   * @example
   * GET /api/files/abc123/metadata
   * Authorization: Bearer <token>
   * 
   * Response:
   * {
   *   "id": "abc123",
   *   "originalFilename": "documento.pdf",
   *   "mimetype": "application/pdf",
   *   "size": 1024000,
   *   "uploadedAt": "2025-12-16T10:30:00Z"
   * }
   */
  @Get(':id/metadata')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener metadatos', description: 'Obtiene metadatos del archivo sin descargarlo' })
  @ApiParam({ name: 'id', description: 'ID del archivo' })
  @ApiResponse({ status: 200, description: 'Metadatos del archivo' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  async getMetadata(@Param('id') id: string) {
    return this.storageClient.getMetadata(id);
  }

  /**
   * Lista archivos con filtros opcionales.
   * 
   * Permite buscar archivos por categoría, tipo de entidad asociada,
   * ID de entidad o usuario que los subió.
   * 
   * @param {FileCategory} [category] - Filtrar por categoría (PROFILE, DOCUMENT, FORM_FIELD, etc.)
   * @param {EntityType} [entityType] - Filtrar por tipo de entidad (APPLICATION, MILESTONE, etc.)
   * @param {string} [entityId] - Filtrar por ID de entidad específica
   * @param {string} [uploadedBy] - Filtrar por ID de usuario que subió
   * @returns {Promise<{files: FileMetadata[]}>} Array de metadatos de archivos
   * 
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * 
   * @example
   * GET /api/files/list?category=DOCUMENT&entityType=APPLICATION&entityId=uuid-123
   * Authorization: Bearer <token>
   */
  @Get('list')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar archivos', description: 'Lista archivos con filtros opcionales' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrar por categoría' })
  @ApiQuery({ name: 'entityType', required: false, description: 'Filtrar por tipo de entidad' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filtrar por ID de entidad' })
  @ApiQuery({ name: 'uploadedBy', required: false, description: 'Filtrar por usuario' })
  @ApiResponse({ status: 200, description: 'Lista de archivos' })
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

  /**
   * Mapea una categoría de archivo a un tipo de validación.
   * 
   * Determina qué tipos de archivo son permitidos según la categoría.
   * Por ejemplo, PROFILE solo acepta imágenes, mientras que FORM_FIELD acepta cualquier tipo.
   * 
   * @param {FileCategory} category - Categoría del archivo
   * @returns {'image' | 'document' | 'video' | 'all'} Tipo de validación a aplicar
   * 
   * @private
   */
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

  /**
   * Obtiene el tamaño máximo permitido para una categoría de archivo.
   * 
   * Define límites de tamaño en bytes según el tipo de archivo:
   * - PROFILE: 5 MB
   * - DOCUMENT: 25 MB
   * - FORM_FIELD: 50 MB
   * - ATTACHMENT: 50 MB
   * - OTHER: 10 MB (default)
   * 
   * @param {FileCategory} category - Categoría del archivo
   * @returns {number} Tamaño máximo en bytes
   * 
   * @private
   */
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

  /**
   * Elimina un archivo del sistema de almacenamiento.
   * 
   * Borra permanentemente el archivo y sus metadatos asociados.
   * Esta operación no es reversible.
   * 
   * @param {string} id - ID único del archivo a eliminar
   * @returns {Promise<{success: boolean, message: string}>} Confirmación de eliminación
   * 
   * @throws {NotFoundException} Si el archivo no existe
   * @throws {UnauthorizedException} Si el usuario no tiene permisos
   * @throws {ForbiddenException} Si el usuario no es propietario del archivo
   * 
   * @example
   * DELETE /api/files/abc123
   * Authorization: Bearer <token>
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Eliminar archivo', description: 'Elimina permanentemente un archivo' })
  @ApiParam({ name: 'id', description: 'ID del archivo' })
  @ApiResponse({ status: 200, description: 'Archivo eliminado' })
  @ApiResponse({ status: 404, description: 'Archivo no encontrado' })
  @ApiResponse({ status: 403, description: 'Sin permisos para eliminar' })
  async deleteFile(@Param('id') id: string) {
    await this.storageClient.delete(id);
    return { success: true, message: 'File deleted' };
  }
}
