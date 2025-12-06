// backend/src/form/form.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ApplicantFormPayload,
  DocumentsByField,
  FormResponseMap,
  FormSectionDTO,
  FormFieldDTO,
  CallDTO,
  ApplicationDTO,
  ResponseScalar,
} from './dto/applicant-form.dto';
import { SaveApplicantFormDto } from './dto/save-applicant-form.dto';

/* ============================
   Row types (FUERA de la clase)
   ============================ */
type SectionRow = {
  id: string;
  title: string;
  order: number;
  visible: boolean;
};
type FieldRow = {
  id: string;
  section_id: string | null;
  name: string;
  label: string;
  type: string;
  required: boolean;
  options: unknown;
  validation: unknown;
  help_text: string | null;
  show_if: unknown;
  order: number;
  visibility: 'PUBLIC' | 'INTERNAL';
};

@Injectable()
export class FormService {
  constructor(private readonly ds: DataSource) {}

  /**
   * Helper centralizado para tipar resultados de query().
   * Concentramos el cast aquí para evitar avisos de "unsafe assignment".
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async q<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rows = await this.ds.query(sql, params);
    return rows as T[];
  }

  /**
   * Normaliza cualquier valor de la BD a un escalar seguro para el DTO
   * (string | number | boolean | null). Evita el cast inseguro.
   */
  private toScalar(val: unknown): ResponseScalar {
    if (val === null) return null;
    const t = typeof val;
    if (t === 'string' || t === 'number' || t === 'boolean')
      return val as ResponseScalar;

    if (val instanceof Date) return val.toISOString();

    try {
      // Si es objeto/array/Buffer u otro tipo serializable
      const s = JSON.stringify(val);
      if (s === undefined) {
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }

  // ======================================================
  // 1) ADMIN - getForm (call + sections + fields)
  // ======================================================
  async getForm(callId: string) {
    const callRows = await this.q<CallDTO>(
      `SELECT id, name, year, status FROM calls WHERE id = $1 LIMIT 1`,
      [callId],
    );
    if (callRows.length === 0) {
      throw new NotFoundException(`Call ${callId} not found`);
    }
    const [call] = callRows;

    const sectionsRows = await this.q<SectionRow>(
      `SELECT id, title, "order", visible
       FROM form_sections
       WHERE call_id = $1
       ORDER BY "order" ASC, title ASC`,
      [callId],
    );
    const sections: FormSectionDTO[] = sectionsRows.map((s) => ({
      id: s.id,
      title: s.title,
      order: Number(s.order),
      visible: Boolean(s.visible),
    }));

    const fieldsRows = await this.q<FieldRow>(
      `SELECT id, section_id, name, label, type, required,
              options, validation, help_text, show_if, "order", visibility
       FROM form_fields
       WHERE call_id = $1 AND active = TRUE
       ORDER BY "order" ASC, label ASC`,
      [callId],
    );
    const fields: FormFieldDTO[] = fieldsRows.map((f) => ({
      id: f.id,
      section_id: f.section_id,
      name: f.name,
      label: f.label,
      type: f.type as FormFieldDTO['type'],
      required: Boolean(f.required),
      options: f.options ?? null,
      validation: f.validation ?? null,
      help_text: f.help_text ?? null,
      show_if: f.show_if ?? null,
      order: Number(f.order),
      visibility: f.visibility,
    }));

    const requirements: unknown[] = []; // placeholder
    return { call, sections, fields, requirements };
  }

  // ==================================================================
  // 2) APPLICANT - getActiveApplicantForm (with sections and fields)
  // ==================================================================
  async getActiveApplicantForm(
    applicantId: string,
  ): Promise<ApplicantFormPayload> {
    // 2.1 Most recent OPEN call
    const openCalls = await this.q<CallDTO>(
      `SELECT id, name, year, status
       FROM calls
       WHERE status = 'OPEN'
       ORDER BY year DESC, created_at DESC
       LIMIT 1`,
    );
    if (openCalls.length === 0) {
      throw new NotFoundException('No open calls at this time');
    }
    const call: CallDTO = openCalls[0];

    // 2.2 Find/create application DRAFT
    const apps = await this.q<{
      id: string;
      status: string;
      submitted_at: string | null;
    }>(
      `SELECT id, status, submitted_at
       FROM applications
       WHERE call_id = $1 AND applicant_id = $2`,
      [call.id, applicantId],
    );

    let application: ApplicationDTO;
    if (apps.length === 0) {
      const inserted = await this.q<{
        id: string;
        status: string;
        submitted_at: string | null;
      }>(
        `INSERT INTO applications (id, applicant_id, call_id, status)
         VALUES (gen_random_uuid(), $1, $2, 'DRAFT')
         RETURNING id, status, submitted_at`,
        [applicantId, call.id],
      );
      application = inserted[0];
    } else {
      application = apps[0];
    }

    // 2.3 Form sections
    const sections = await this.q<FormSectionDTO>(
      `SELECT id, title, "order", visible
       FROM form_sections
       WHERE call_id = $1
       ORDER BY "order" ASC, title ASC`,
      [call.id],
    );

    // 2.4 PUBLIC and active fields
    const fields = await this.q<FormFieldDTO>(
      `SELECT
         id, section_id, name, label, type, required,
         options, validation, help_text, show_if, "order", visibility
       FROM form_fields
       WHERE call_id = $1
         AND active = TRUE
         AND visibility = 'PUBLIC'
       ORDER BY "order" ASC, label ASC`,
      [call.id],
    );

    // 2.5 Saved responses (if they exist)
    const respRows = await this.q<{ field_id: string; value: unknown }>(
      `SELECT field_id, value
       FROM form_responses
       WHERE application_id = $1`,
      [application.id],
    );

    const responses: FormResponseMap = {};
    for (const r of respRows) {
      responses[r.field_id] = { value: this.toScalar(r.value) };
    }

    // 2.6 Current documents by field
    const docs = await this.q<{
      id: string;
      form_field_id: string | null;
      type: string;
      filename: string;
      validation_status: string;
      is_current: boolean;
    }>(
      `SELECT id, form_field_id, type, filename, validation_status, is_current
       FROM documents
       WHERE application_id = $1
         AND is_current = TRUE`,
      [application.id],
    );

    const documentsByField: DocumentsByField = {};
    for (const d of docs) {
      const key = d.form_field_id ?? '_NO_FIELD_';
      if (!documentsByField[key]) documentsByField[key] = [];
      documentsByField[key].push({
        id: d.id,
        type: d.type,
        filename: d.filename,
        validation_status: d.validation_status,
        is_current: !!d.is_current,
        form_field_id: d.form_field_id,
      });
    }

    return { call, application, sections, fields, responses, documentsByField };
  }

  // ======================================================
  // 3) Guardar borrador (stub para compilar)
  // ======================================================
  async saveApplicantForm(applicationId: string, _body: SaveApplicantFormDto) {
    await this.ds.query('SELECT 1'); // dummy await
    void applicationId;
    void _body;
    return { updated: 0 };
  }

  // ======================================================
  // 4) GET /api/forms/:formId - Obtener formulario por ID
  // ======================================================
  async getFormById(formId: string) {
    // Primero intentar obtener el call_id desde el milestone
    const milestoneRows = await this.q<{ call_id: string }>(
      `SELECT call_id FROM milestones WHERE form_id = $1 LIMIT 1`,
      [formId],
    );
    
    let callId: string | null = null;
    if (milestoneRows.length > 0) {
      callId = milestoneRows[0].call_id;
    }
    
    // Si tenemos callId, intentar cargar desde form_sections + form_fields (sistema nuevo)
    if (callId) {
      const sectionsRows = await this.q<{
        id: string;
        title: string;
        order: number;
        visible: boolean;
      }>(
        `SELECT id, title, "order", visible FROM form_sections WHERE call_id = $1 ORDER BY "order"`,
        [callId],
      );
      
      if (sectionsRows.length > 0) {
        // Hay secciones en el sistema nuevo, construir el schema desde ahí
        const sections: any[] = [];
        
        for (const section of sectionsRows) {
          const fieldsRows = await this.q<{
            id: string;
            name: string;
            label: string;
            type: string;
            required: boolean;
            options: unknown;
            validation: unknown;
            help_text: string | null;
            order: number;
            active: boolean;
          }>(
            `SELECT id, name, label, type, required, options, validation, help_text, "order", active 
             FROM form_fields 
             WHERE call_id = $1 AND section_id = $2 
             ORDER BY "order"`,
            [callId, section.id],
          );
          
          sections.push({
            id: section.id,
            title: section.title,
            fields: fieldsRows.map(f => ({
              id: f.id,
              name: f.name,
              label: f.label,
              type: f.type,
              required: f.required,
              options: f.options || null,
              helpText: f.help_text,
              active: f.active,
            })),
          });
        }
        
        return {
          id: formId,
          name: `Formulario de convocatoria`,
          description: null,
          schema: { fields: sections },
        };
      }
    }
    
    // Fallback: intentar cargar desde forms.schema (sistema viejo)
    const formRows = await this.q<{
      id: string;
      name: string;
      description: string | null;
      schema: unknown;
    }>(
      `SELECT id, name, description, schema FROM forms WHERE id = $1 LIMIT 1`,
      [formId],
    );
    
    if (formRows.length === 0) {
      throw new NotFoundException(`Form ${formId} not found`);
    }
    
    return formRows[0];
  }
}
