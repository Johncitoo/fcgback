import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Roles } from '../auth/roles.decorator';

@Controller('audit')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('actor') actor?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    return this.auditService.getAuditLogs({
      action,
      entity,
      actor,
      from,
      to,
      limit: limitNum,
      offset: offsetNum,
    });
  }
}
