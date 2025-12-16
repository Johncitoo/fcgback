import { Injectable } from '@nestjs/common';

/**
 * Service principal de la aplicación.
 * 
 * Proporciona lógica de negocio para el AppController.
 * Actualmente solo retorna mensaje de bienvenida.
 */
@Injectable()
export class AppService {
  /**
   * Retorna un mensaje de bienvenida del API.
   * 
   * @returns Mensaje de bienvenida
   * 
   * @example
   * const message = getHello();
   * // "Hello World!"
   */
  getHello(): string {
    return 'Hello World!';
  }
}
