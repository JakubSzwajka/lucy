import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  await app.listen(3000);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }

  const config = new DocumentBuilder()
    .setTitle('Notion proxy api')
    .setDescription('The notion proxy API description')
    .setVersion('1.0')
    .build();

    const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

}
bootstrap();
