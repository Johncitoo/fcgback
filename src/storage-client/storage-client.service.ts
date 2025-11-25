import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

export enum FileCategory {
  PROFILE = 'PROFILE',
  DOCUMENT = 'DOCUMENT',
  FORM_FIELD = 'FORM_FIELD',
  ATTACHMENT = 'ATTACHMENT',
  OTHER = 'OTHER',
}

export enum EntityType {
  USER = 'USER',
  APPLICATION = 'APPLICATION',
  FORM_ANSWER = 'FORM_ANSWER',
  INSTITUTION = 'INSTITUTION',
  OTHER = 'OTHER',
}

export interface UploadFileOptions {
  category: FileCategory;
  entityType?: EntityType;
  entityId?: string;
  uploadedBy: string;
  description?: string;
}

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

@Injectable()
export class StorageClientService {
  private readonly logger = new Logger(StorageClientService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    const baseURL = this.config.get<string>('STORAGE_SERVICE_URL');
    this.apiKey = this.config.get<string>('STORAGE_SERVICE_API_KEY')!;

    if (!baseURL || !this.apiKey) {
      throw new Error(
        'STORAGE_SERVICE_URL and STORAGE_SERVICE_API_KEY must be configured',
      );
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
   * Upload a file to storage service
   */
  async upload(
    file: Express.Multer.File,
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
   * Download a file from storage
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
   * Get file metadata
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
   * Get thumbnail for image files
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
   * List files by filters
   */
  async list(filters?: {
    category?: FileCategory;
    entityType?: EntityType;
    entityId?: string;
    uploadedBy?: string;
  }): Promise<FileMetadata[]> {
    try {
      const response = await this.client.get('/storage/list', {
        params: filters,
      });
      return response.data.files;
    } catch (error: any) {
      this.logger.error(`List files failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a file (soft delete)
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
   * Get direct view URL (for embedding in frontend)
   */
  getViewUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/view/${fileId}`;
  }

  /**
   * Get download URL
   */
  getDownloadUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/download/${fileId}`;
  }

  /**
   * Get thumbnail URL
   */
  getThumbnailUrl(fileId: string): string {
    return `${this.client.defaults.baseURL}/storage/thumbnail/${fileId}`;
  }
}
