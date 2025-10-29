import { Controller, Get, Put, Post, Query, Body, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('admin/forms')
export class AdminFormsController {
  constructor(private ds: DataSource) {}

  // GET /api/admin/forms?callId=UUID
  @Get()
  async getForm(@Query('callId') callId: string) {
    if (!callId) {
      throw new BadRequestException('callId is required');
    }

    // Obtener información de la convocatoria
    const call = await this.ds.query(
      `SELECT id, name as code, name as title, year FROM calls WHERE id = $1 LIMIT 1`,
      [callId]
    );

    if (!call || call.length === 0) {
      throw new BadRequestException('Call not found');
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
      WHERE call_id = $1 
      ORDER BY "order" ASC
      `,
      [callId]
    );

    // Obtener campos
    const fields = await this.ds.query(
      `
      SELECT 
        id, 
        section_id as "sectionId",
        name, 
        label, 
        type, 
        required, 
        options, 
        validation, 
        help_text as "helpText",
        "order",
        active
      FROM form_fields 
      WHERE call_id = $1 
      ORDER BY "order" ASC
      `,
      [callId]
    );

    // Agrupar campos por sección
    const sectionsWithFields = sections.map((sec: any) => ({
      id: sec.id,
      title: sec.title,
      description: '',
      commentBox: false,
      fields: fields
        .filter((f: any) => f.sectionId === sec.id)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          label: f.label,
          type: f.type,
          helpText: f.helpText,
          required: f.required,
          active: f.active,
          options: f.options || [],
        })),
    }));

    return {
      call: call[0],
      sections: sectionsWithFields,
    };
  }

  // PUT /api/admin/forms?callId=UUID
  @Put()
  async saveForm(@Query('callId') callId: string, @Body() body: any) {
    if (!callId) {
      throw new BadRequestException('callId is required');
    }

    const { sections } = body;

    if (!sections || !Array.isArray(sections)) {
      throw new BadRequestException('sections array is required');
    }

    // Verificar que la convocatoria existe
    const callCheck = await this.ds.query(`SELECT id FROM calls WHERE id = $1`, [callId]);
    if (!callCheck || callCheck.length === 0) {
      throw new BadRequestException('Call not found');
    }

    try {
      // Eliminar secciones y campos existentes
      await this.ds.query(`DELETE FROM form_fields WHERE call_id = $1`, [callId]);
      await this.ds.query(`DELETE FROM form_sections WHERE call_id = $1`, [callId]);

      // Insertar nuevas secciones y campos
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        // Crear sección (siempre generamos nuevo UUID)
        const [newSection] = await this.ds.query(
          `
          INSERT INTO form_sections (id, call_id, title, "order", visible)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
          RETURNING id
          `,
          [callId, section.title || 'Sin título', i, true]
        );

        const actualSectionId = newSection.id;

        // Insertar campos de esta sección
        if (section.fields && Array.isArray(section.fields)) {
          for (let j = 0; j < section.fields.length; j++) {
            const field = section.fields[j];

            await this.ds.query(
              `
              INSERT INTO form_fields (
                id, call_id, section_id, name, label, type, 
                required, options, validation, help_text, show_if, "order", 
                active, visibility, editable_by_roles
              )
              VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5::form_field_type, 
                $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11,
                $12, $13, $14::jsonb
              )
              `,
              [
                callId,
                actualSectionId,
                field.name || 'campo',
                field.label || 'Campo sin nombre',
                field.type || 'TEXT',
                field.required !== false,
                field.options ? JSON.stringify(field.options) : null,
                field.validation ? JSON.stringify(field.validation) : null,
                field.helpText || null,
                field.showIf ? JSON.stringify(field.showIf) : null,
                j,
                field.active !== false,
                field.visibility || 'PUBLIC',
                field.editableByRoles ? JSON.stringify(field.editableByRoles) : '["APPLICANT"]',
              ]
            );
          }
        }
      }

      return { ok: true };
    } catch (error) {
      console.error('Error saving form:', error);
      throw new BadRequestException(`Error saving form: ${error.message}`);
    }
  }

  // POST /api/admin/forms/clone
  @Post('clone')
  async cloneForm(@Body() body: { fromCallId: string; toCallId: string }) {
    const { fromCallId, toCallId } = body;

    if (!fromCallId || !toCallId) {
      throw new BadRequestException('fromCallId and toCallId are required');
    }

    // Verificar que ambas convocatorias existan
    const [fromCall, toCall] = await Promise.all([
      this.ds.query(`SELECT id FROM calls WHERE id = $1 LIMIT 1`, [fromCallId]),
      this.ds.query(`SELECT id FROM calls WHERE id = $1 LIMIT 1`, [toCallId]),
    ]);

    if (!fromCall || fromCall.length === 0) {
      throw new BadRequestException('Source call not found');
    }

    if (!toCall || toCall.length === 0) {
      throw new BadRequestException('Target call not found');
    }

    // Eliminar secciones y campos existentes en la convocatoria destino
    await this.ds.query(`DELETE FROM form_fields WHERE call_id = $1`, [toCallId]);
    await this.ds.query(`DELETE FROM form_sections WHERE call_id = $1`, [toCallId]);

    // Obtener secciones de origen
    const sections = await this.ds.query(
      `SELECT * FROM form_sections WHERE call_id = $1 ORDER BY "order" ASC`,
      [fromCallId]
    );

    // Mapeo de IDs antiguos a nuevos
    const sectionIdMap = new Map<string, string>();

    // Copiar secciones
    for (const section of sections) {
      const [newSection] = await this.ds.query(
        `
        INSERT INTO form_sections (id, call_id, title, "order", visible)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
        RETURNING id
        `,
        [toCallId, section.title, section.order, section.visible]
      );

      sectionIdMap.set(section.id, newSection.id);
    }

    // Obtener campos de origen
    const fields = await this.ds.query(
      `SELECT * FROM form_fields WHERE call_id = $1 ORDER BY "order" ASC`,
      [fromCallId]
    );

    // Copiar campos
    for (const field of fields) {
      const newSectionId = sectionIdMap.get(field.section_id);
      
      await this.ds.query(
        `
        INSERT INTO form_fields (
          id, call_id, section_id, name, label, type, 
          required, options, validation, help_text, "order", active
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 
          $6, $7, $8, $9, $10, $11
        )
        `,
        [
          toCallId, newSectionId, field.name, field.label, field.type,
          field.required, field.options, field.validation, 
          field.help_text, field.order, field.active
        ]
      );
    }

    return { ok: true };
  }
}
