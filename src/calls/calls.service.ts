import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Call, FormSection, FormField } from './entities';
import { CallStatus } from './entities/call.entity';
import { Form } from '../forms/entities/form.entity';
import { Milestone } from '../milestones/entities/milestone.entity';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call)
    private callRepo: Repository<Call>,
    @InjectRepository(FormSection)
    private sectionRepo: Repository<FormSection>,
    @InjectRepository(FormField)
    private fieldRepo: Repository<FormField>,
    @InjectRepository(Form)
    private formRepo: Repository<Form>,
    @InjectRepository(Milestone)
    private milestoneRepo: Repository<Milestone>,
  ) {}

  async listCalls(params: {
    limit: number;
    offset: number;
    onlyActive: boolean;
    needCount: boolean;
  }) {
    const { limit, offset, onlyActive, needCount } = params;

    const queryBuilder = this.callRepo
      .createQueryBuilder('c')
      .orderBy('c.year', 'DESC')
      .addOrderBy('c.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (onlyActive) {
      // Filtrar solo convocatorias activas según lógica híbrida
      queryBuilder
        .where('c.status = :status', { status: 'OPEN' })
        .andWhere('c.isActive = :isActive', { isActive: true })
        .andWhere(
          '(c.startDate IS NULL OR c.startDate <= :now)',
          { now: new Date() },
        )
        .andWhere(
          '(c.autoClose = false OR c.endDate IS NULL OR c.endDate > :now)',
          { now: new Date() },
        );
    }

    const [data, total] = needCount
      ? await queryBuilder.getManyAndCount()
      : [await queryBuilder.getMany(), undefined];

    return { data, total, limit, offset };
  }

  async getCallById(id: string) {
    const call = await this.callRepo.findOne({ where: { id } });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    return call;
  }

  async createCall(body: any) {
    if (!body.name || !body.year) {
      throw new BadRequestException('Name and year are required');
    }

    const call = this.callRepo.create({
      name: body.name,
      year: body.year,
      status: body.status || 'DRAFT',
      totalSeats: body.totalSeats || 0,
      minPerInstitution: body.minPerInstitution || 0,
      dates: body.dates || null,
      rules: body.rules || null,
      formPublishedAt: body.formPublishedAt || null,
      isActive: body.isActive || false,
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      autoClose: body.autoClose !== undefined ? body.autoClose : true,
    });

    const saved = await this.callRepo.save(call);
    return saved;
  }

  async updateCall(id: string, body: any) {
    const call = await this.callRepo.findOne({ where: { id } });

    if (!call) {
      throw new NotFoundException('Call not found');
    }

    // Validación: Solo puede haber una convocatoria activa a la vez
    if (body.isActive === true) {
      const existingActive = await this.callRepo.findOne({
        where: {
          isActive: true,
          status: CallStatus.OPEN,
        },
      });

      if (existingActive && existingActive.id !== id) {
        throw new BadRequestException(
          `Solo puede haber una convocatoria activa a la vez. "${existingActive.name} ${existingActive.year}" ya está activa. Desactívala primero.`,
        );
      }
    }

    // Actualizar solo los campos presentes en body
    if (body.name !== undefined) call.name = body.name;
    if (body.year !== undefined) call.year = body.year;
    if (body.status !== undefined) call.status = body.status;
    if (body.totalSeats !== undefined) call.totalSeats = body.totalSeats;
    if (body.minPerInstitution !== undefined)
      call.minPerInstitution = body.minPerInstitution;
    if (body.dates !== undefined) call.dates = body.dates;
    if (body.rules !== undefined) call.rules = body.rules;
    if (body.formPublishedAt !== undefined)
      call.formPublishedAt = body.formPublishedAt;
    
    // Nuevos campos de control de activación
    if (body.startDate !== undefined) call.startDate = body.startDate;
    if (body.endDate !== undefined) call.endDate = body.endDate;
    if (body.isActive !== undefined) call.isActive = body.isActive;
    if (body.autoClose !== undefined) call.autoClose = body.autoClose;

    await this.callRepo.save(call);

    return { ok: true, updated: true };
  }

  async getForm(callId: string) {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      select: ['id', 'name', 'year'],
    });

    if (!call) throw new NotFoundException('Call not found');

    // PRIORIDAD: Buscar formulario nuevo a través de milestones
    const milestone = await this.milestoneRepo.findOne({
      where: { callId, formId: Not(IsNull()) },
      order: { orderIndex: 'ASC' },
    });

    if (milestone?.formId) {
      const form = await this.formRepo.findOne({
        where: { id: milestone.formId },
      });

      if (form) {
        // El Form Builder guarda el schema en formato JSON stringificado
        // Necesitamos parsearlo
        const schema = typeof form === 'object' && 'schema' in form 
          ? (form as any).schema 
          : null;

        if (schema && schema.sections) {
          return {
            id: call.id,
            title: form.name || call.name,
            year: call.year,
            sections: schema.sections,
          };
        }
      }
    }

    // FALLBACK: Formulario viejo (form_sections + form_fields)
    const sections = await this.sectionRepo.find({
      where: { callId },
      order: { order: 'ASC' },
    });

    const fields = await this.fieldRepo.find({
      where: { callId, active: true },
      order: { order: 'ASC' },
    });

    // agrupar campos por sección
    const bySection = sections.map((section) => ({
      ...section,
      fields: fields.filter((field) => field.sectionId === section.id),
    }));

    return { 
      id: call.id,
      title: call.name, // Frontend espera 'title'
      year: call.year,
      sections: bySection 
    };
  }
}
