import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import type { Multer } from 'multer';
import { FileMetadata as FileMetadataEntity } from './entities/file-metadata.entity';

/**
 * Categorías de archivos en el sistema.
 */
export enum FileCategory {
  PROFILE = 'PROFILE',        // Foto de perfil
  DOCUMENT = 'DOCUMENT',      // Documentos oficiales (certificados, cédula)
  FORM_FIELD = 'FORM_FIELD',  // Adjuntos de campos de formulario
  ATTACHMENT = 'ATTACHMENT',  // Adjuntos generales
  OTHER = 'OTHER',            // Otros archivos
}

/**
 * Tipos de entidad a la que pertenece un archivo.
 */
export enum EntityType {
  USER = 'USER',
  APPLICATION = 'APPLICATION',
  FORM_ANSWER = 'FORM_ANSWER',
  INSTITUTION = 'INSTITUTION',
  OTHER = 'OTHER',
}

/**
 * Opciones para subir un archivo.
 */
export interface UploadFileOptions {
  category: FileCategory;
  entityType?: EntityType;
  entityId?: string;
  uploadedBy: string;
  milestoneSubmissionId?: string;
  description?: string;
}

/**
 * Metadata completa de un archivo.
 */
export interface FileMetadata {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimetype: string;
  size: number;
  category: FileCategory;
  entityType?: EntityType;
  entityId?: string;
  path: string;
  thumbnailPath?: string;
  uploadedBy: string;
  description?: string;
  uploadedAt: Date;
  active: boolean;
}

/**
 * Cliente HTTP para interactuar con el servicio de almacenamiento externo.
 * 
 * Proporciona operaciones CRUD para archivos:
 * - Upload: Envía archivo al storage service con metadata
 * - Download: Descarga archivo por ID
 * - Delete: Eliminación lógica (soft delete)
 * - List: Consulta local de metadata filtrada
 * - Metadata: Obtiene metadata de archivo
 * - Thumbnail: Genera thumbnail para imágenes
 * - URLs: Construye URLs públicas para view/download/thumbnail
 * 
 * Configuración:
 * - STORAGE_SERVICE_URL: URL base del servicio (Railway)
 * - STORAGE_SERVICE_API_KEY: API key para autenticación
 * 
 * Almacenamiento dual:
 * - Archivos: Servicio externo (Railway)
 * - Metadata: BD local (file_metadata)
 */
@Injectable()
export class StorageClientService {
  private readonly logger = new Logger(StorageClientService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FileMetadataEntity)
    private readonly fileMetadataRepo: Repository<FileMetadataEntity>
  ) {
    let baseURL = this.config.get<string>('STORAGE_SERVICE_URL');
    this.apiKey = this.config.get<string>('STORAGE_SERVICE_API_KEY')!;

    if (!baseURL || !this.apiKey) {
      throw new Error(
        'STORAGE_SERVICE_URL and STORAGE_SERVICE_API_KEY must be configured',
      );
    }

    // Ensure URL has protocol
    if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
      baseURL = `https://${baseURL}`;
      this.logger.warn(`Added https:// protocol to STORAGE_SERVICE_URL: ${baseURL}`);
    }

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    this.logger.log(`Storage client initialized: ${baseURL}`);
  }

  /**
   * Sube un archivo al servicio de almacenamiento.
   * 
   * Flujo:
   * 1. Crea FormData con archivo y metadata
   * 2. Envía POST a /storage/upload con X-API-Key
   * 3. Storage service guarda archivo y crea metadata en BD
   * 4. Retorna metadata del archivo subido
   * 
   * @param file - Archivo de Multer (buffer, originalname, mimetype)
   * @param options - Opciones de upload (category, entityType, entityId, uploadedBy, etc.)
   * @returns Metadata del archivo subido con id, paths, size, etc.
   * @throws Error si falla la comunicación con el storage service
   */
  async upload(
    file: Multer.File,
    options: UploadFileOptions,
  ): Promise<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    formData.append('category', options.category);
    if (options.entityType) formData.append('entityType', options.entityType);
    if (options.entityId) formData.append('entityId', options.entityId);
    formData.append('uploadedBy', options.uploadedBy);
    if (options.milestoneSubmissionId) formData.append('milestoneSubmissionId', options.milestoneSubmissionId);
    if (options.description)
      formData.append('description', options.description);

    try {
      this.logger.debug(`Uploading file to storage: ${file.originalname}`);
      this.logger.debug(`Storage URL: ${this.client.defaults.baseURL}/storage/upload`);
      
      const response = await this.client.post('/storage/upload', formData, {
        headers: formData.getHeaders(),
      });
      
      this.logger.log(`File uploaded successfully: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Upload failed: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`);
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }

  /**
   * Descarga un archivo del storage service.
   * 
   * @param fileId - UUID del archivo
   * @returns Buffer con contenido del archivo
   * @throws Error si el archivo no existe o falla la descarga
   */
  async download(fileId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/storage/download/${fileId}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Download failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene metadata de un archivo desde el storage service.
   * 
   * @param fileId - UUID del archivo
   * @returns Metadata completa del archivo
   * @throws Error si el archivo no existe
   */
  async getMetadata(fileId: string): Promise<FileMetadata> {
    try {
      const response = await this.client.get(`/storage/metadata/${fileId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Get metadata failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Descarga thumbnail de una imagen.
   * El storage service genera automáticamente thumbnails para imágenes.
   * 
   * @param fileId - UUID del archivo
   * @returns Buffer con thumbnail (generalmente JPEG)
   * @throws Error si el archivo no es imagen o no existe
   */
  async getThumbnail(fileId: string): Promise<Buffer> {
    try {
      const response = await this.client.get(`/storage/thumbnail/${fileId}`, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Get thumbnail failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lista archivos consultando la BD local (file_metadata).
   * No consulta el storage service, solo metadata.
   * Solo retorna archivos activos (active = true).
   * 
   * @param filters - Filtros opcionales:
   *   - category: Filtrar por categoría (PROFILE, DOCUMENT, etc.)
   *   - entityType: Filtrar por tipo de entidad (USER, APPLICATION, etc.)
   *   - entityId: Filtrar por ID de entidad específico
   *   - uploadedBy: Filtrar por usuario que subió el archivo
   * @returns Array de metadata ordenado por uploadedAt descendente
   */
  async list(filters?: {
    category?: FileCategory;
    entityType?: EntityType;
    entityId?: string;
    uploadedBy?: string;
  }): Promise<FileMetadata[]> {
    try {
      this.logger.log(`List files called with filters: ${JSON.stringify(filters)}`);
      
      const where: any = { active: true };
      
      if (filters?.category) where.category = filters.category;
      if (filters?.entityType) where.entityType = filters.entityType;
      if (filters?.entityId) where.entityId = filters.entityId;
      if (filters?.uploadedBy) where.uploadedBy = filters.uploadedBy;

      this.logger.log(`Query where: ${JSON.stringify(where)}`);

      const files = await this.fileMetadataRepo.find({
        where,
        order: { uploadedAt: 'DESC' }
      });

      this.logger.log(`Found ${files.length} files`);
      
      return files as any;
    } catch (error: any) {
      this.logger.error(`List files failed: ${error.message}`);
      this.logger.error(`Stack: ${error.stack}`);
      throw error;
    }
  }

  /**
   * Elimina un archivo (soft delete).
   * Marca active = false en metadata, no elimina físicamente.
   * 
   * @param fileId - UUID del archivo
   * @throws Error si el archivo no existe o falla la eliminación
   */
  async delete(fileId: string): Promise<void> {
    try {
      await this.client.delete(`/storage/${fileId}`);
    } catch (error: any) {
      this.logger.error(`Delete failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Construye URL pública para visualizar archivo en el navegador.
   * Útil para incrustar imágenes o PDFs en el frontend.
   * 
   * @param fileId - UUID del archivo
   * @returns URL completa para /storage/view/:id
   */
  getViewUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/view/${fileId}`;
  }

  /**
   * Construye URL pública para descargar archivo.
   * Añade header Content-Disposition: attachment.
   * 
   * @param fileId - UUID del archivo
   * @returns URL completa para /storage/download/:id
   */
  getDownloadUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/download/${fileId}`;
  }

  /**
   * Construye URL pública para thumbnail de imagen.
   * 
   * @param fileId - UUID del archivo
   * @returns URL completa para /storage/thumbnail/:id
   */
  getThumbnailUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/thumbnail/${fileId}`;
  }
}
