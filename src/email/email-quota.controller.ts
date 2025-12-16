import { Controller, Get } from '@nestjs/common';
import { EmailService, DualEmailQuotaStatus } from './email.service';
import { Roles } from '../auth/roles.decorator';

@Controller('email')
@Roles('ADMIN') // Solo administradores pueden ver la cuota
export class EmailQuotaController {
  constructor(private readonly emailService: EmailService) {}

  /**
   * GET /api/email/quota/dual
   * Obtiene el estado de ambas cuentas de email
   */
  @Get('quota/dual')
  async getDualQuotaStatus(): Promise<DualEmailQuotaStatus> {
    return this.emailService.getDualQuotaStatus();
  }
}
