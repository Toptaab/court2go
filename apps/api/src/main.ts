import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Web app (apps/web) is a separate origin; it sends the session cookie.
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({ origin: webOrigin, credentials: true });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(`court2go API listening on :${port}`);
}

void bootstrap();
