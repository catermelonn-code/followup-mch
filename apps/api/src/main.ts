import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OverdueService } from './jobs/overdue.service';
import { PrismaService } from './prisma.service';
import { seedIfEmpty } from './seed';
import { sleep } from './util';

async function waitForDb(prisma: PrismaService, log: Logger) {
  for (let i = 1; i <= 40; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch {
      log.warn(`等待数据库... (${i}/40)`);
      await sleep(1000);
    }
  }
  throw new Error('数据库未就绪');
}

async function bootstrap() {
  const log = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { cors: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  const prisma = app.get(PrismaService);
  await waitForDb(prisma, log);
  try {
    const result = await seedIfEmpty(prisma);
    log.log(`seed: ${JSON.stringify(result)}`);
  } catch (e) {
    log.error(`seed failed: ${e}`);
  }
  const overdue = app.get(OverdueService);
  await overdue.scan('bootstrap');
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  log.log(`API http://0.0.0.0:${port}/api`);
}

bootstrap();
