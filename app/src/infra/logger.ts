import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class JsonLoggerService implements LoggerService {
  log(message: any, context?: any): void {
    console.info(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'log',
        message,
        context,
      })
    );
  }

  error(message: any, trace: string, context?: any): void {
    console.error(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'error',
        message,
        trace,
        context,
      })
    );
  }

  warn(message: any, context?: any): void {
    console.warn(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'warn',
        message,
        context,
      })
    );
  }

  debug(message: any, ...optionalParams: any[]) {
    console.debug(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'debug',
        message,
        optionalParams,
      })
    );
  }

  fatal(message: any, ...optionalParams: any[]) {
    console.error(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'fatal',
        message,
        optionalParams,
      })
    );
  }

  verbose(message: any, ...optionalParams: any[]) {
    console.log(
      JSON.stringify({
        timestamp: new Date().getTime(),
        level: 'verbose',
        message,
        optionalParams,
      })
    );
  }
}
