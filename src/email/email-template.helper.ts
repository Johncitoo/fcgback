/**
 * Helper para generar emails con diseño corporativo de la Fundación Carmen Goudie.
 * 
 * Paleta de colores institucional:
 * - Primario: #1e3a5f (azul oscuro profesional)
 * - Secundario: #2d5f8b (azul medio)
 * - Acento: #c4a962 (dorado/beige elegante)
 * - Fondo: #f8f9fa (gris muy claro)
 * - Texto: #333333 (gris oscuro)
 * - Texto secundario: #6b7280 (gris medio)
 */

export class EmailTemplateHelper {
  // Colores institucionales
  static readonly COLORS = {
    primary: '#1e3a5f',      // Azul oscuro profesional
    secondary: '#2d5f8b',    // Azul medio
    accent: '#c4a962',       // Dorado elegante
    background: '#f8f9fa',   // Gris muy claro
    cardBg: '#ffffff',       // Blanco
    text: '#333333',         // Texto principal
    textSecondary: '#6b7280', // Texto secundario
    border: '#e5e7eb',       // Bordes
    warning: '#d97706',      // Ámbar para advertencias
    warningBg: '#fffbeb',    // Fondo advertencias
    success: '#059669',      // Verde éxito
    successBg: '#ecfdf5',    // Fondo éxito
  };

  /**
   * Genera la estructura base del email con header y footer institucional.
   */
  static wrapEmail(content: string, year: number = new Date().getFullYear()): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Fundación Carmen Goudie</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.7; color: ${this.COLORS.text}; margin: 0; padding: 0; background-color: ${this.COLORS.background};">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${this.COLORS.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; max-width: 600px;">
                
                <!-- HEADER -->
                <tr>
                  <td style="background: linear-gradient(135deg, ${this.COLORS.primary} 0%, ${this.COLORS.secondary} 100%); padding: 35px 40px; text-align: center; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px;">
                      Fundación Carmen Goudie
                    </h1>
                    <div style="width: 60px; height: 3px; background-color: ${this.COLORS.accent}; margin: 15px auto 0;"></div>
                  </td>
                </tr>
                
                <!-- CONTENT -->
                <tr>
                  <td style="background-color: ${this.COLORS.cardBg}; padding: 40px; border: 1px solid ${this.COLORS.border}; border-top: none;">
                    ${content}
                  </td>
                </tr>
                
                <!-- FOOTER -->
                <tr>
                  <td style="background-color: ${this.COLORS.primary}; padding: 30px 40px; text-align: center; border-radius: 0 0 12px 12px;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px;">
                      © ${year} Fundación Carmen Goudie
                    </p>
                    <p style="margin: 0; color: rgba(255,255,255,0.6); font-size: 12px;">
                      Este es un correo automático, por favor no respondas a este mensaje.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Genera un saludo con el nombre del destinatario.
   */
  static greeting(name?: string): string {
    const displayName = name ? ` ${name}` : '';
    return `
      <h2 style="color: ${this.COLORS.primary}; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
        Estimado/a${displayName},
      </h2>
    `;
  }

  /**
   * Genera un párrafo estándar.
   */
  static paragraph(text: string): string {
    return `
      <p style="margin: 0 0 16px 0; color: ${this.COLORS.text}; font-size: 15px;">
        ${text}
      </p>
    `;
  }

  /**
   * Genera un botón de acción principal.
   */
  static button(text: string, url: string): string {
    return `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}" 
           style="display: inline-block; padding: 14px 32px; background-color: ${this.COLORS.primary}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          ${text}
        </a>
      </div>
    `;
  }

  /**
   * Genera una caja con código destacado.
   */
  static codeBox(label: string, code: string): string {
    return `
      <div style="background-color: ${this.COLORS.background}; border: 2px solid ${this.COLORS.primary}; padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: ${this.COLORS.textSecondary}; text-transform: uppercase; letter-spacing: 1px;">
          ${label}
        </p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: ${this.COLORS.primary}; letter-spacing: 4px; font-family: 'Courier New', monospace;">
          ${code}
        </p>
      </div>
    `;
  }

  /**
   * Genera una caja de credenciales.
   */
  static credentialsBox(email: string, password: string): string {
    return `
      <div style="background-color: ${this.COLORS.background}; border: 1px solid ${this.COLORS.border}; border-radius: 10px; padding: 25px; margin: 25px 0;">
        <h3 style="margin: 0 0 20px 0; color: ${this.COLORS.primary}; font-size: 16px; font-weight: 600;">
          Credenciales de acceso
        </h3>
        <div style="margin: 12px 0; padding: 12px 15px; background-color: ${this.COLORS.cardBg}; border-radius: 6px; border-left: 3px solid ${this.COLORS.accent};">
          <div style="font-size: 11px; color: ${this.COLORS.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            Correo electrónico
          </div>
          <div style="font-size: 15px; color: ${this.COLORS.text}; font-family: monospace;">
            ${email}
          </div>
        </div>
        <div style="margin: 12px 0; padding: 12px 15px; background-color: ${this.COLORS.cardBg}; border-radius: 6px; border-left: 3px solid ${this.COLORS.accent};">
          <div style="font-size: 11px; color: ${this.COLORS.textSecondary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            Contraseña temporal
          </div>
          <div style="font-size: 15px; color: ${this.COLORS.text}; font-family: monospace;">
            ${password}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Genera una nota importante (advertencia).
   */
  static warningNote(title: string, content: string): string {
    return `
      <div style="background-color: ${this.COLORS.warningBg}; border-left: 4px solid ${this.COLORS.warning}; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 14px; color: ${this.COLORS.text};">
          <strong style="color: ${this.COLORS.warning};">${title}:</strong> ${content}
        </p>
      </div>
    `;
  }

  /**
   * Genera una nota de información.
   */
  static infoNote(content: string): string {
    return `
      <div style="background-color: #f0f7ff; border-left: 4px solid ${this.COLORS.secondary}; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 14px; color: ${this.COLORS.text};">
          ${content}
        </p>
      </div>
    `;
  }

  /**
   * Genera una nota de éxito.
   */
  static successNote(content: string): string {
    return `
      <div style="background-color: ${this.COLORS.successBg}; border-left: 4px solid ${this.COLORS.success}; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; font-size: 14px; color: ${this.COLORS.text};">
          ${content}
        </p>
      </div>
    `;
  }

  /**
   * Genera un enlace secundario (texto pequeño).
   */
  static linkFallback(url: string): string {
    return `
      <p style="margin: 20px 0 0 0; font-size: 12px; color: ${this.COLORS.textSecondary};">
        Si el botón no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="margin: 5px 0 0 0; word-break: break-all; font-size: 12px; color: ${this.COLORS.secondary};">
        ${url}
      </p>
    `;
  }

  /**
   * Genera una lista ordenada con estilo.
   */
  static orderedList(items: string[]): string {
    const listItems = items.map((item, index) => `
      <tr>
        <td style="padding: 8px 0; vertical-align: top;">
          <span style="display: inline-block; width: 24px; height: 24px; background-color: ${this.COLORS.primary}; color: #ffffff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">
            ${index + 1}
          </span>
        </td>
        <td style="padding: 8px 0 8px 12px; vertical-align: middle; color: ${this.COLORS.text}; font-size: 15px;">
          ${item}
        </td>
      </tr>
    `).join('');

    return `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 20px 0;">
        ${listItems}
      </table>
    `;
  }

  /**
   * Genera una caja de contenido destacado (para mensajes personalizados).
   */
  static messageBox(message: string): string {
    return `
      <div style="background-color: ${this.COLORS.cardBg}; padding: 20px; border-left: 4px solid ${this.COLORS.primary}; margin: 20px 0; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${message.replace(/\n/g, '<br>')}
      </div>
    `;
  }
}
