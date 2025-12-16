import { Injectable } from '@nestjs/common';

/**
 * Variables para renderizar en plantillas de email.
 * Permite cualquier combinación de strings, números o undefined.
 */
export interface TemplateVariables {
  [key: string]: string | number | undefined;
}

/**
 * Servicio de renderizado de plantillas de email.
 * 
 * Usa sintaxis simple de reemplazo de variables: {{variable_name}}
 * No usa librerías externas como Handlebars para mantener simplicidad.
 * 
 * Funcionalidades:
 * - Renderizar plantillas con variables
 * - Extraer variables presentes en una plantilla
 * - Validar que una plantilla tenga las variables requeridas
 * - Generar previews con datos de ejemplo
 */
@Injectable()
export class TemplateRendererService {
  /**
   * Renderiza una plantilla reemplazando variables {{variable_name}} con valores reales
   * @param template HTML template con variables
   * @param variables Objeto con los valores de las variables
   * @returns HTML renderizado con las variables reemplazadas
   */
  render(template: string, variables: TemplateVariables): string {
    let rendered = template;

    // Reemplazar cada variable en el formato {{variable_name}}
    Object.keys(variables).forEach((key) => {
      const value = variables[key];
      const placeholder = `{{${key}}}`;
      
      // Reemplazar todas las ocurrencias de la variable
      rendered = rendered.split(placeholder).join(value !== undefined ? String(value) : '');
    });

    return rendered;
  }

  /**
   * Extrae todas las variables presentes en una plantilla
   * @param template HTML template
   * @returns Array de nombres de variables encontradas
   */
  extractVariables(template: string): string[] {
    const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }

    return matches;
  }

  /**
   * Valida que una plantilla contenga todas las variables requeridas
   * @param template HTML template
   * @param requiredVars Array de variables que deben estar presentes
   * @returns Objeto con resultado y variables faltantes
   */
  validate(template: string, requiredVars: string[]): { valid: boolean; missing: string[] } {
    const presentVars = this.extractVariables(template);
    const missing = requiredVars.filter(v => !presentVars.includes(v));

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Renderiza plantilla con datos de ejemplo para preview
   * @param template HTML template
   * @param templateKey Clave del template para obtener valores de ejemplo
   * @returns HTML renderizado con datos de ejemplo
   */
  renderPreview(template: string, templateKey: string): string {
    const sampleData = this.getSampleData(templateKey);
    return this.render(template, sampleData);
  }

  /**
   * Genera datos de ejemplo para preview de plantillas.
   * Retorna un conjunto de variables de muestra según el tipo de plantilla.
   * 
   * Plantillas soportadas:
   * - INVITE_APPLICANT, PASSWORD_SET, PASSWORD_RESET
   * - FORM_SUBMITTED, MILESTONE_APPROVED, MILESTONE_REJECTED
   * - MILESTONE_NEEDS_CHANGES, WELCOME
   * 
   * @param templateKey - Clave de la plantilla
   * @returns Objeto con variables de ejemplo para esa plantilla
   */
  private getSampleData(templateKey: string): TemplateVariables {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    const samples: Record<string, TemplateVariables> = {
      INVITE_APPLICANT: {
        applicant_name: 'María González',
        call_name: 'Becas de Estudio 2025',
        invite_code: 'ABC-123-XYZ',
        invite_link: `${baseUrl}/invites/ABC-123-XYZ`,
      },
      PASSWORD_SET: {
        applicant_name: 'Juan Pérez',
        call_name: 'Becas de Estudio 2025',
        password_set_link: `${baseUrl}/auth/set-password?token=ejemplo-token`,
      },
      PASSWORD_RESET: {
        applicant_name: 'Ana Torres',
        reset_link: `${baseUrl}/auth/reset-password?token=ejemplo-token`,
      },
      FORM_SUBMITTED: {
        applicant_name: 'Carlos Ramírez',
        call_name: 'Becas de Estudio 2025',
        form_name: 'Formulario de Postulación Inicial',
        submission_date: new Date().toLocaleString('es-ES', { 
          dateStyle: 'long', 
          timeStyle: 'short' 
        }),
        dashboard_link: `${baseUrl}/dashboard`,
      },
      MILESTONE_APPROVED: {
        applicant_name: 'Sofía Martínez',
        call_name: 'Becas de Estudio 2025',
        milestone_name: 'Entrevista Personal',
        next_milestone_name: 'Evaluación Final',
        dashboard_link: `${baseUrl}/dashboard`,
      },
      MILESTONE_REJECTED: {
        applicant_name: 'Diego López',
        call_name: 'Becas de Estudio 2025',
        milestone_name: 'Evaluación de Documentos',
      },
      MILESTONE_NEEDS_CHANGES: {
        applicant_name: 'Valentina Rojas',
        call_name: 'Becas de Estudio 2025',
        milestone_name: 'Documentos Académicos',
        reviewer_comments: 'Por favor, adjunta el certificado de notas del último año completo. El documento actual está incompleto.',
        dashboard_link: `${baseUrl}/dashboard`,
      },
      WELCOME: {
        applicant_name: 'Camila Fernández',
        dashboard_link: `${baseUrl}/dashboard`,
      },
    };

    return samples[templateKey] || {};
  }
}
