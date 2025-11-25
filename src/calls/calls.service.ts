import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, FormSection, FormField } from './entities';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call)
    private callRepo: Repository<Call>,
    @InjectRepository(FormSection)
    private sectionRepo: Repository<FormSection>,
    @InjectRepository(FormField)
    private fieldRepo: Repository<FormField>,
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
      queryBuilder.where('c.status = :status', { status: 'OPEN' });
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
    });

    const saved = await this.callRepo.save(call);
    return saved;
  }

  async updateCall(id: string, body: any) {
    const call = await this.callRepo.findOne({ where: { id } });

    if (!call) {
      throw new NotFoundException('Call not found');
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

    await this.callRepo.save(call);

    return { ok: true, updated: true };
  }

  async getForm(callId: string) {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      select: ['id', 'name', 'year'],
    });

    if (!call) throw new NotFoundException('Call not found');

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

    return { ...call, sections: bySection };
  }
}
