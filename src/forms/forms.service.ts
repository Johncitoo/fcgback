import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from './entities/form.entity';

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Form)
    private formsRepo: Repository<Form>,
  ) {}

  /**
   * Crea un nuevo formulario en el Form Builder.
   * Acepta sections array o schema completo.
   * 
   * @param data - Datos del formulario (name/title, description, schema/sections)
   * @returns Formulario creado
   * 
   * @example
   * const form = await create({ name: 'Formulario Test', sections: [...] });
   */
  async create(data: {
    name?: string;
    title?: string;
    description?: string;
    isTemplate?: boolean;
    parentFormId?: string;
    schema?: any;
    sections?: any[];
  }): Promise<Form> {
    // Mapear title → name si viene title
    const formData: any = {
      name: data.name || data.title || 'Formulario sin título',
      description: data.description,
      isTemplate: data.isTemplate,
      parentFormId: data.parentFormId,
    };

    // Si viene sections, guardarlo en schema
    if (data.sections && Array.isArray(data.sections)) {
      formData.schema = { sections: data.sections };
    } else if (data.schema) {
      formData.schema = data.schema;
    }

    const form = this.formsRepo.create(formData);
    // @ts-ignore
    return this.formsRepo.save(form);
  }

  /**
   * Lista todos los formularios con filtro opcional por plantillas.
   * 
   * @param isTemplate - Filtro opcional (true para plantillas, false para formularios regulares)
   * @returns Array de formularios
   * 
   * @example
   * const templates = await findAll(true);
   */
  async findAll(isTemplate?: boolean): Promise<Form[]> {
    const query = this.formsRepo.createQueryBuilder('form');
    if (isTemplate !== undefined) {
      query.where('form.is_template = :isTemplate', { isTemplate });
    }
    return query.getMany();
  }

  /**
   * Obtiene un formulario por su ID.
   * Usa query raw para evitar cache de TypeORM.
   * Parsea el schema automáticamente si viene como string.
   * 
   * @param id - ID del formulario
   * @returns Formulario con schema parseado
   * @throws {NotFoundException} Si el formulario no existe
   * 
   * @example
   * const form = await findOne('uuid-123');
   */
  async findOne(id: string): Promise<Form> {
    const timestamp = new Date().toISOString();
    console.log(`[FormsService ${timestamp}] findOne buscando form:`, id);
    
    // CRÍTICO: Usar query raw para evitar cache de TypeORM
    const rawResult = await this.formsRepo.manager.query(
      'SELECT * FROM forms WHERE id = $1',
      [id]
    );
    
    if (!rawResult || rawResult.length === 0) {
      throw new NotFoundException(`Form ${id} not found`);
    }
    
    const form = rawResult[0];
    
    // Parsear schema si viene como string
    if (typeof form.schema === 'string') {
      try {
        form.schema = JSON.parse(form.schema);
      } catch (err) {
        console.warn('[FormsService] No se pudo parsear schema:', err);
      }
    }
    
    console.log(`[FormsService ${timestamp}] findOne RESULTADO:`, {
      id: form.id,
      hasSchema: !!form.schema,
      schemaType: typeof form.schema,
      sectionsInSchema: form.schema?.sections?.length || 0,
      allSectionIds: form.schema?.sections?.map((s: any) => s.id) || [],
      updated_at: form.updated_at
    });
    
    return form as Form;
  }

  /**
   * Actualiza parcialmente un formulario.
   * Maneja sections array o schema completo. Usa query raw para evitar cache.
   * 
   * @param id - ID del formulario
   * @param data - Campos a actualizar (name/title, description, sections/schema)
   * @returns Formulario actualizado
   * 
   * @example
   * const form = await update('uuid-123', { name: 'Nuevo Nombre', sections: [...] });
   */
  async update(id: string, data: any): Promise<Form> {
    const timestamp = new Date().toISOString();
    console.log(`[FormsService ${timestamp}] ===== UPDATE INICIADO =====`);
    console.log(`[FormsService ${timestamp}] UPDATE form ID:`, id);
    console.log(`[FormsService ${timestamp}] Sections a guardar:`, data.sections?.length || 0);
    console.log(`[FormsService ${timestamp}] IDs de sections:`, data.sections?.map((s: any) => s.id) || []);
    
    // Mapear igual que en create
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.title !== undefined) updateData.name = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate;
    if (data.parentFormId !== undefined) updateData.parentFormId = data.parentFormId;
    
    // Si viene sections, guardarlo en schema
    if (data.sections && Array.isArray(data.sections)) {
      console.log('[FormsService] Guardando sections en schema:', data.sections.length);
      updateData.schema = { sections: data.sections };
    } else if (data.schema !== undefined) {
      console.log('[FormsService] Guardando schema directamente');
      updateData.schema = data.schema;
    }

    console.log('[FormsService] updateData que se guardará:', JSON.stringify(updateData, null, 2));
    
    // CAMBIO: Usar save en lugar de update para JSONB
    // TypeORM .update() puede no actualizar correctamente campos JSONB
    const existing = await this.formsRepo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Form ${id} not found`);
    }
    
    // Merge los cambios en la entidad existente
    const merged = this.formsRepo.merge(existing, updateData);
    console.log('[FormsService] Merged entity antes de save:', {
      id: merged.id,
      hasSchema: !!merged.schema,
      sectionsInSchema: merged.schema?.sections?.length || 0
    });
    
    // CRÍTICO: Usar queryRunner para forzar commit inmediato
    const queryRunner = this.formsRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    
    try {
      // Actualizar usando SQL directo para evitar problemas de serialización JSONB
      await queryRunner.manager.query(
        `UPDATE forms SET 
          name = $1, 
          description = $2, 
          schema = $3::jsonb,
          updated_at = NOW()
        WHERE id = $4`,
        [
          updateData.name || existing.name,
          updateData.description !== undefined ? updateData.description : existing.description,
          JSON.stringify(updateData.schema || existing.schema),
          id
        ]
      );
      
      // Commit explícito
      await queryRunner.commitTransaction();
      console.log(`[FormsService ${timestamp}] Transaction committed para form:`, id);
      
      // Leer DESPUÉS del commit
      const verified = await this.findOne(id);
      console.log(`[FormsService ${timestamp}] ===== UPDATE COMPLETADO =====`);
      console.log(`[FormsService ${timestamp}] Form verificado después de commit:`, {
        id: verified.id,
        hasSchema: !!verified.schema,
        sectionsInSchema: verified.schema?.sections?.length || 0,
        allSectionIds: verified.schema?.sections?.map((s: any) => s.id) || []
      });
      
      return verified;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('[FormsService] Error en transacción:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async remove(id: string): Promise<void> {
    await this.formsRepo.delete(id);
  }

  async createVersion(formId: string, changes: Partial<Form>): Promise<Form> {
    const original = await this.findOne(formId);
    const newVersion = this.formsRepo.create({
      ...changes,
      parentFormId: formId,
      version: original.version + 1,
    });
    return this.formsRepo.save(newVersion);
  }
}
