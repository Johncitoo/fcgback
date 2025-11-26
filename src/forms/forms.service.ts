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
    const form = await this.formsRepo.findOne({ where: { id } });
    if (!form) {
      throw new NotFoundException(`Form ${id} not found`);
    }
    return form;
  }

  async update(id: string, data: Partial<Form>): Promise<Form> {
    await this.formsRepo.update(id, data);
    return this.findOne(id);
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
