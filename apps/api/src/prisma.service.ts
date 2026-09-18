import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    for (let i = 0; i < 40; i++) {
      try {
        await this.$connect();
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    await this.$connect();
  }
}
