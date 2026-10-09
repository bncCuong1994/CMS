import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export function configureApp(app: import('@nestjs/common').INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true, credentials: true });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('CMS API').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc);

  await app.listen(Number(process.env.PORT ?? 3000));
}

if (require.main === module) {
  void bootstrap();
}
