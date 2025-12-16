import { Injectable } from '@nestjs/common';

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
