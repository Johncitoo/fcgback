import { Controller, Get } from '@nestjs/common';
import { EmailService, DualEmailQuotaStatus } from './email.service';
import { Roles } from '../auth/roles.decorator';

/**
 * Controlador para consultar estado de cuotas de email.
 * 
 * Expone endpoint para obtener estadísticas de uso de ambas cuentas:
 * - Cuenta 1 (Transaccional): used, limit, remaining, percentage
 * - Cuenta 2 (Masivos): used, limit, remaining, percentage
 * - Totales combinados
 * 
 * Seguridad: Solo ADMIN
 */
@Controller('email')
@Roles('ADMIN') // Solo administradores pueden ver la cuota
export class EmailQuotaController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * GET /api/email/quota/dual
   * 
   * Obtiene el estado de uso de ambas cuentas de email.
   * Datos extraídos de email_quota_tracking (registro diario).
   * 
   * @returns DualEmailQuotaStatus con:
   *   - account1: Cuenta transaccional (confirmaciones, password reset)
   *   - account2: Cuenta masivos (invitaciones, anuncios)
   *   - total: Suma de ambas cuentas
   *   - Cada cuenta incluye: used, limit, remaining, percentage, resetAt
   */
  @Get('quota/dual')
  async getDualQuotaStatus(): Promise<DualEmailQuotaStatus> {
    return this.emailService.getDualQuotaStatus();
  }
}
