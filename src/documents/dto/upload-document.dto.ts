import {
  IsUUID,
  IsString,
  IsInt,
  Min,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { DocumentType } from '../documents.entity';

export class UploadDocumentDto {
  @IsUUID()
  applicationId: string;

  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  fileName: string;

  @IsString()
  mimeType: string; // se mapea a contentType

  @IsInt()
  @Min(1)
  sizeKb: number; // se mapea a sizeBytes

  @IsOptional()
  @IsString()
  storageUrl?: string; // ignorado por ahora
}
