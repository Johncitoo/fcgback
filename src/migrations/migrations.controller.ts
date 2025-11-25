import { Controller, Post } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('api/migrations')
export class MigrationsController {
  constructor(private readonly ds: DataSource) {}

  @Post('add-institution-to-applicants')
  async addInstitutionToApplicants() {
    try {
      await this.ds.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'applicants' AND column_name = 'institution_id'
          ) THEN
            ALTER TABLE applicants
            ADD COLUMN institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;
            
            RAISE NOTICE 'Columna institution_id agregada a tabla applicants';
          ELSE
            RAISE NOTICE 'Columna institution_id ya existe en tabla applicants';
          END IF;
        END $$;
      `);

      return { success: true, message: 'Migración ejecutada correctamente' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
