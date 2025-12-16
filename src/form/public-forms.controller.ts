import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

/**
 * Controlador para acceso público a formularios de convocatorias.
 * 
 * Expone formularios sin autenticación para:
 * - Vista previa pública de la convocatoria activa
 * - Vista de formulario de convocatoria específica
 * 
 * Solo muestra secciones y campos visibles (visible = true, active = true).
 * 
 * Seguridad: Público (sin autenticación)
 */
@Controller('public')
@Public()
export class PublicFormsController {
  constructor(private ds: DataSource) {}

  /**
   * GET /api/public/form
   * 
   * Obtiene el formulario de la convocatoria activa (status = 'OPEN').
   * Solo retorna secciones visibles y campos activos.
   * 
   * Flujo:
   * 1. Busca convocatoria con status = 'OPEN'
   * 2. Obtiene secciones visibles ordenadas
   * 3. Obtiene campos activos de esas secciones
   * 4. Agrupa campos por sección
   * 
   * @returns Objeto con call (id, name, year, status) y sections (array con fields)
   * @throws NotFoundException si no hay convocatoria activa
   */
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

  /**
   * GET /api/public/form/:callId
   * 
   * Obtiene el formulario de una convocatoria específica.
   * Permite vista pública de formularios de convocatorias pasadas o futuras.
   * Solo retorna secciones visibles y campos activos.
   * 
   * @param callId - UUID de la convocatoria
   * @returns Objeto con call (id, name, year, status) y sections (array con fields)
   * @throws NotFoundException si no existe la convocatoria
   */
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
