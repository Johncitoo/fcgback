import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, CallStatus } from './entities/call.entity';

/**
 * Servicio para gestión automática de estados de convocatorias.
 * 
 * Funcionalidades:
 * - Auto-activación: Cambia DRAFT → OPEN cuando se alcanza start_date
 * - Auto-cierre: Cambia OPEN → CLOSED cuando se alcanza end_date
 * - Validación de coherencia de estados
 * 
 * Este servicio debe ejecutarse periódicamente (ej: cada hora con cron)
 * o puede invocarse manualmente desde un endpoint administrativo.
 * 
 * Nota: Para ejecución automática, instalar @nestjs/schedule y usar @Cron()
 */
@Injectable()
export class CallsSchedulerService {
  private readonly logger = new Logger(CallsSchedulerService.name);

  constructor(
    @InjectRepository(Call)
    private callRepo: Repository<Call>,
  ) {}

  /**
   * Verifica y actualiza estados de convocatorias según sus fechas.
   * 
   * Lógica:
   * 1. Busca calls con start_date/end_date definidas
   * 2. Si now >= start_date y status=DRAFT → cambia a OPEN
   * 3. Si now > end_date y status=OPEN → cambia a CLOSED
   * 4. Solo actualiza calls con autoClose=true
   * 
   * @returns Objeto con estadísticas de actualizaciones realizadas
   * 
   * @example
   * const result = await checkAndUpdateCallStatuses();
   * // { activated: 2, closed: 1, checked: 45 }
   */
  async checkAndUpdateCallStatuses(): Promise<{
    activated: number;
    closed: number;
    checked: number;
  }> {
    this.logger.log('🔍 Verificando estados de convocatorias...');

    const now = new Date();
    let activated = 0;
    let closed = 0;

    try {
      // Obtener todas las convocatorias con fechas definidas y autoClose habilitado
      const calls = await this.callRepo.find({
        where: [
          { autoClose: true },
        ],
      });

      this.logger.log(`📋 Encontradas ${calls.length} convocatorias para revisar`);

      for (const call of calls) {
        // Saltar si no tiene fechas definidas
        if (!call.startDate || !call.endDate) {
          continue;
        }

        const startDate = new Date(call.startDate);
        const endDate = new Date(call.endDate);

        // 1. Auto-activación: DRAFT → OPEN si ya pasó start_date
        if (
          call.status === CallStatus.DRAFT &&
          now >= startDate &&
          now <= endDate
        ) {
          this.logger.log(`✅ Activando convocatoria: ${call.name} ${call.year}`);
          call.status = CallStatus.OPEN;
          call.isActive = true;
          await this.callRepo.save(call);
          activated++;
        }

        // 2. Auto-cierre: OPEN → CLOSED si ya pasó end_date
        if (call.status === CallStatus.OPEN && now > endDate) {
          this.logger.log(`🔒 Cerrando convocatoria: ${call.name} ${call.year}`);
          call.status = CallStatus.CLOSED;
          call.isActive = false;
          await this.callRepo.save(call);
          closed++;
        }
      }

      this.logger.log(
        `✅ Proceso completado: ${activated} activadas, ${closed} cerradas de ${calls.length} revisadas`,
      );

      return {
        activated,
        closed,
        checked: calls.length,
      };
    } catch (error) {
      this.logger.error('❌ Error al verificar estados de convocatorias', error);
      throw error;
    }
  }

  /**
   * Verifica el estado de una convocatoria específica y la actualiza si corresponde.
   * 
   * @param callId - ID de la convocatoria a verificar
   * @returns Boolean indicando si se realizó alguna actualización
   */
  async checkAndUpdateSingleCall(callId: string): Promise<boolean> {
    this.logger.log(`🔍 Verificando convocatoria: ${callId}`);

    const call = await this.callRepo.findOne({ where: { id: callId } });

    if (!call) {
      this.logger.warn(`⚠️  Convocatoria no encontrada: ${callId}`);
      return false;
    }

    if (!call.startDate || !call.endDate || !call.autoClose) {
      this.logger.log(`⏭️  Convocatoria ${call.name} no tiene auto-cierre habilitado`);
      return false;
    }

    const now = new Date();
    const startDate = new Date(call.startDate);
    const endDate = new Date(call.endDate);
    let updated = false;

    if (call.status === CallStatus.DRAFT && now >= startDate && now <= endDate) {
      this.logger.log(`✅ Activando: ${call.name}`);
      call.status = CallStatus.OPEN;
      call.isActive = true;
      await this.callRepo.save(call);
      updated = true;
    }

    if (call.status === CallStatus.OPEN && now > endDate) {
      this.logger.log(`🔒 Cerrando: ${call.name}`);
      call.status = CallStatus.CLOSED;
      call.isActive = false;
      await this.callRepo.save(call);
      updated = true;
    }

    return updated;
  }
}
