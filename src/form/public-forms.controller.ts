import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

@Controller('public')
@Public()
export class PublicFormsController {
  constructor(private ds: DataSource) {}

  // GET /api/public/form - Vista pública del formulario de la convocatoria activa
  @Get('form')
  async getPublicForm() {
    // Buscar convocatoria activa (status = OPEN)
    const call = await this.ds.query(
      `SELECT id, name, year, status FROM calls WHERE status = 'OPEN' ORDER BY created_at DESC LIMIT 1`
    );

    if (!call || call.length === 0) {
      throw new NotFoundException('No hay convocatoria activa en este momento');
    }

    const callId = call[0].id;

    // Obtener secciones (sin description porque no existe en la tabla)
    const sections = await this.ds.query(
      `
      SELECT 
        id, 
        title, 
        "order",
        visible
      FROM form_sections 
      WHERE call_id = $1 AND visible = true
      ORDER BY "order" ASC
      `,
      [callId]
    );

    // Obtener campos activos de cada sección
    const sectionIds = sections.map((s: any) => s.id);
    
    let fields = [];
    if (sectionIds.length > 0) {
      fields = await this.ds.query(
        `
        SELECT 
          id, 
          section_id as "sectionId",
          name, 
          label, 
          type, 
          required, 
          options, 
          help_text as "helpText",
          "order",
          active
        FROM form_fields 
        WHERE section_id = ANY($1) AND active = true
        ORDER BY "order" ASC
        `,
        [sectionIds]
      );
    }

    // Agrupar campos por sección
    const sectionsWithFields = sections.map((section: any) => ({
      id: section.id,
      title: section.title,
      fields: fields
        .filter((f: any) => f.sectionId === section.id)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
          helpText: f.helpText,
          active: f.active,
        })),
    }));

    return {
      call: {
        id: call[0].id,
        name: call[0].name,
        year: call[0].year,
        status: call[0].status,
      },
      sections: sectionsWithFields,
    };
  }

  // GET /api/public/form/:callId - Vista pública de una convocatoria específica (opcional)
  @Get('form/:callId')
  async getPublicFormByCall(@Param('callId') callId: string) {
    // Verificar que la convocatoria exista
    const call = await this.ds.query(
      `SELECT id, name, year, status FROM calls WHERE id = $1 LIMIT 1`,
      [callId]
    );

    if (!call || call.length === 0) {
      throw new NotFoundException('Convocatoria no encontrada');
    }

    // Obtener secciones
    const sections = await this.ds.query(
      `
      SELECT 
        id, 
        title, 
        "order",
        visible
      FROM form_sections 
      WHERE call_id = $1 AND visible = true
      ORDER BY "order" ASC
      `,
      [callId]
    );

    // Obtener campos activos
    const sectionIds = sections.map((s: any) => s.id);
    
    let fields = [];
    if (sectionIds.length > 0) {
      fields = await this.ds.query(
        `
        SELECT 
          id, 
          section_id as "sectionId",
          name, 
          label, 
          type, 
          required, 
          options, 
          help_text as "helpText",
          "order",
          active
        FROM form_fields 
        WHERE section_id = ANY($1) AND active = true
        ORDER BY "order" ASC
        `,
        [sectionIds]
      );
    }

    // Agrupar campos por sección
    const sectionsWithFields = sections.map((section: any) => ({
      id: section.id,
      title: section.title,
      fields: fields
        .filter((f: any) => f.sectionId === section.id)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
          helpText: f.helpText,
          active: f.active,
        })),
    }));

    return {
      call: {
        id: call[0].id,
        name: call[0].name,
        year: call[0].year,
        status: call[0].status,
      },
      sections: sectionsWithFields,
    };
  }
}
