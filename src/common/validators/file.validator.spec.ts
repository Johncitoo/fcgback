import { FileValidator } from './file.validator';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';

describe('FileValidator', () => {
  describe('Filename Sanitization', () => {
    it('should remove special characters', () => {
      const filename = 'my!@#$%^&*()file.pdf';
      const sanitized = FileValidator.sanitizeFilename(filename);
      expect(sanitized).toBe('my_file.pdf');
    });

    it('should preserve safe characters', () => {
      const filename = 'my-file_name.2024.pdf';
      const sanitized = FileValidator.sanitizeFilename(filename);
      expect(sanitized).toBe('my-file_name.2024.pdf');
    });

    it('should limit filename length', () => {
      const longFilename = 'a'.repeat(300) + '.pdf';
      const sanitized = FileValidator.sanitizeFilename(longFilename);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });

    it('should preserve file extension', () => {
      const filename = 'my!@#file.docx';
      const sanitized = FileValidator.sanitizeFilename(filename);
      expect(sanitized).toMatch(/\.docx$/);
    });
  });

  describe('Unique Filename Generation', () => {
    it('should generate unique filenames', () => {
      const original = 'document.pdf';
      const unique1 = FileValidator.generateUniqueFilename(original);
      const unique2 = FileValidator.generateUniqueFilename(original);
      
      expect(unique1).not.toBe(unique2);
      expect(unique1).toMatch(/\.pdf$/);
      expect(unique2).toMatch(/\.pdf$/);
    });

    it('should include timestamp in unique filename', () => {
      const original = 'test.pdf';
      const unique = FileValidator.generateUniqueFilename(original);
      
      expect(unique).toMatch(/_\d+_/); // Timestamp pattern
    });
  });

  describe('File Validation - Integration Tests', () => {
    it('should validate valid PDF file', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: pdfBuffer,
        size: 1024 * 1024, // 1MB
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).not.toThrow();
    });

    it('should reject oversized file', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: pdfBuffer,
        size: 100 * 1024 * 1024, // 100MB
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).toThrow(BadRequestException);
    });

    it('should reject executable files', () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a]); // .exe magic
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malware.exe',
        encoding: '7bit',
        mimetype: 'application/pdf', // Fake MIME type
        buffer: exeBuffer,
        size: 1024,
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).toThrow(BadRequestException);
    });

    it('should reject files with path traversal', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '../../../etc/passwd',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: pdfBuffer,
        size: 1024,
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).toThrow(BadRequestException);
    });

    it('should reject files with wrong MIME type', () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'document.pdf',
        encoding: '7bit',
        mimetype: 'image/jpeg', // Wrong MIME type
        buffer: pdfBuffer,
        size: 1024,
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).toThrow(BadRequestException);
    });

    it('should reject files with mismatched magic numbers', () => {
      const fakeBuffer = Buffer.from([0xFF, 0xD8, 0xFF]); // JPEG magic
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'fake.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf', // Claims to be PDF
        buffer: fakeBuffer,
        size: 1024,
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'document' })).toThrow(BadRequestException);
    });

    it('should validate valid JPEG image', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'photo.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        buffer: jpegBuffer,
        size: 2 * 1024 * 1024, // 2MB
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'image' })).not.toThrow();
    });

    it('should validate valid PNG image', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'image.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: pngBuffer,
        size: 3 * 1024 * 1024, // 3MB
        stream: new Readable(),
        destination: '',
        filename: '',
        path: '',
      };

      expect(() => FileValidator.validate(mockFile, { category: 'image' })).not.toThrow();
    });
  });
});
