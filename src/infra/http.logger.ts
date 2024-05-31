import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HTTPLoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl } = request;
    const startTime = Date.now();

    response.on('finish', () => {
      const { statusCode } = response;
      const duration = Date.now() - startTime;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { cookie, authorization, ...requestWithoutCookies } =
        request.headers;

      // use debug method for /metrics endpoint and /health endpoint
      if (originalUrl === '/metrics' || originalUrl === '/health') {
        this.logger.debug({
          method,
          originalUrl,
          statusCode,
          duration: `${duration}ms`,
          //   headers: env.LOG_HTTP_HEADERS ? requestWithoutCookies : undefined,
        });
      } else {
        this.logger.log({
          method,
          originalUrl,
          statusCode,
          duration: `${duration}ms`,
          //   headers: env.LOG_HTTP_HEADERS ? requestWithoutCookies : undefined,
        });
      }
    });
    next();
  }
}
