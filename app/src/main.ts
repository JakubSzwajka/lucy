import { env } from 'src/env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, );
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(env.PORT);
}
bootstrap();
