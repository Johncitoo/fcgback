import { BadRequestException } from '@nestjs/common';

// Tipos MIME permitidos por categoría
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'image': [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  'document': [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  'video': [
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
  ],
  'all': [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
  ],
};

// Tamaños máximos por tipo (en bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  'image': 10 * 1024 * 1024,      // 10 MB
  'document': 50 * 1024 * 1024,   // 50 MB
  'video': 500 * 1024 * 1024,     // 500 MB
  'default': 25 * 1024 * 1024,    // 25 MB
};

// Magic numbers para validar tipo MIME real
const FILE_SIGNATURES: Record<string, Buffer[]> = {
  'image/jpeg': [
    Buffer.from([0xFF, 0xD8, 0xFF]),
  ],
  'image/png': [
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  ],
  'application/pdf': [
    Buffer.from([0x25, 0x50, 0x44, 0x46]),  // %PDF
  ],
  'image/gif': [
    Buffer.from([0x47, 0x49, 0x46, 0x38]),  // GIF8
  ],
};

export interface FileValidationOptions {
  category?: 'image' | 'document' | 'video' | 'all';
  maxSize?: number;
  allowedExtensions?: string[];
}

export class FileValidator {
  /**
   * Valida un archivo subido
   */
  static validate(
    file: Express.Multer.File,
    options: FileValidationOptions = {}
  ): void {
    const {
      category = 'all',
      maxSize,
      allowedExtensions,
    } = options;

    // 1. Verificar que existe el archivo
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided or file is empty');
    }

    // 2. Validar nombre de archivo
    this.validateFilename(file.originalname);

    // 3. Validar tamaño
    const maxFileSize = maxSize || MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;
    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size: ${Math.floor(maxFileSize / 1024 / 1024)} MB`
      );
    }

    // 4. Validar MIME type (por extensión)
    const allowedMimes = ALLOWED_MIME_TYPES[category] || ALLOWED_MIME_TYPES.all;
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`
      );
    }

    // 5. Validar MIME type real (magic numbers)
    if (!this.validateMagicNumbers(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'File content does not match declared type. Possible file manipulation detected.'
      );
    }

    // 6. Validar extensión
    if (allowedExtensions && allowedExtensions.length > 0) {
      const extension = this.getExtension(file.originalname);
      if (!allowedExtensions.includes(extension)) {
        throw new BadRequestException(
          `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`
        );
      }
    }

    // 7. Validar que no sea ejecutable
    this.validateNotExecutable(file.originalname);
  }

  /**
   * Valida el nombre de archivo (previene path traversal)
   */
  private static validateFilename(filename: string): void {
    // No permitir caracteres especiales peligrosos
    const dangerousChars = /[<>:"|?*\x00-\x1F]/g;
    if (dangerousChars.test(filename)) {
      throw new BadRequestException('Filename contains invalid characters');
    }

    // No permitir path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Filename cannot contain path separators');
    }

    // Longitud máxima
    if (filename.length > 255) {
      throw new BadRequestException('Filename too long (max 255 characters)');
    }

    // No permitir nombres vacíos
    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('Filename cannot be empty');
    }
  }

  /**
   * Valida magic numbers (firma del archivo)
   */
  private static validateMagicNumbers(buffer: Buffer, mimeType: string): boolean {
    const signatures = FILE_SIGNATURES[mimeType];
    
    if (!signatures) {
      // Si no tenemos firma para este tipo, permitir
      return true;
    }

    // Verificar si alguna firma coincide
    return signatures.some(signature => {
      return buffer.subarray(0, signature.length).equals(signature);
    });
  }

  /**
   * Obtiene la extensión del archivo
   */
  private static getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
  }

  /**
   * Valida que no sea un archivo ejecutable
   */
  private static validateNotExecutable(filename: string): void {
    const executableExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
      '.jar', '.dll', '.sh', '.app', '.deb', '.rpm', '.dmg', '.pkg',
      '.msi', '.apk', '.ipa',
    ];

    const extension = this.getExtension(filename);
    if (executableExtensions.includes(extension)) {
      throw new BadRequestException(
        'Executable files are not allowed'
      );
    }
  }

  /**
   * Sanitiza el nombre de archivo (para guardar)
   */
  static sanitizeFilename(filename: string): string {
    // Remover caracteres especiales
    let sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .trim();

    // Asegurar que tenga extensión
    const extension = this.getExtension(filename);
    if (!extension) {
      sanitized += '.bin';
    }

    // Limitar longitud
    if (sanitized.length > 255) {
      const ext = this.getExtension(sanitized);
      const nameWithoutExt = sanitized.slice(0, sanitized.length - ext.length);
      sanitized = nameWithoutExt.slice(0, 250) + ext;
    }

    return sanitized;
  }

  /**
   * Genera un nombre de archivo único
   */
  static generateUniqueFilename(originalFilename: string): string {
    const extension = this.getExtension(originalFilename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitized = this.sanitizeFilename(
      originalFilename.replace(extension, '')
    ).slice(0, 50);
    
    return `${sanitized}_${timestamp}_${random}${extension}`;
  }
}
