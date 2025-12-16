import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
@Public()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Endpoint raíz del API.
   * Retorna un mensaje de bienvenida.
   * 
   * @returns Mensaje de bienvenida
   * 
   * @example
   * GET /
   * Response: "Fundación Carmen Goudie API v1.0"
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Endpoint de health check del API.
   * Retorna estado del servicio, versión y lista de migraciones aplicadas.
   * 
   * @returns Objeto con status, version, timestamp y migrations
   * 
   * @example
   * GET /health
   * Response: { "status": "ok", "version": "1.0.2-rut-optional", "timestamp": "2024-03-15T10:00:00Z" }
   */
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
