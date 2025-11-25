import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      version: '1.0.2-rut-optional',
      timestamp: new Date().toISOString(),
      migrations: [
        'institution_id added',
        'rut validation optional',
        'first_name/last_name nullable',
        'rut constraint partial index',
        'rut_number/rut_dv nullable'
      ]
    };
  }
}
