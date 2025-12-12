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

  async findAll(isTemplate?: boolean): Promise<Form[]> {
    const query = this.formsRepo.createQueryBuilder('form');
    if (isTemplate !== undefined) {
      query.where('form.is_template = :isTemplate', { isTemplate });
    }
    return query.getMany();
  }

  async findOne(id: string): Promise<Form> {
    console.log('[FormsService] findOne buscando form:', id);
    const form = await this.formsRepo.findOne({ where: { id } });
    if (!form) {
      throw new NotFoundException(`Form ${id} not found`);
    }
    console.log('[FormsService] findOne encontró form:', {
      id: form.id,
      hasSchema: !!form.schema,
      schemaType: typeof form.schema,
      sectionsInSchema: form.schema?.sections?.length || 0,
      schemaContent: JSON.stringify(form.schema)
    });
    return form;
  }

  async update(id: string, data: any): Promise<Form> {
    console.log('[FormsService] UPDATE recibido para form:', id);
    console.log('[FormsService] Data recibido:', JSON.stringify(data, null, 2));
    
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
    
    await this.formsRepo.update(id, updateData);
    
    console.log('[FormsService] Update ejecutado, obteniendo form actualizado...');
    const updated = await this.findOne(id);
    console.log('[FormsService] Form después de update:', {
      id: updated.id,
      hasSchema: !!updated.schema,
      sectionsInSchema: updated.schema?.sections?.length || 0
    });
    
    return updated;
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
