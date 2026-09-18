import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { todayDate } from '../util';

@Injectable()
export class OverdueService {
  private readonly log = new Logger(OverdueService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Shanghai' })
  async dailyScan() {
    await this.scan('cron-08:00');
  }

  @Cron('0 * * * *', { timeZone: 'Asia/Shanghai' })
  async hourlyScan() {
    await this.scan('cron-hourly');
  }

  async scan(reason = 'manual') {
    const today = todayDate();
    const pending = await this.prisma.followUpTask.findMany({
      where: { status: 'pending', planDate: { lt: today } },
      select: { id: true, status: true },
    });
    if (pending.length === 0) {
      this.log.log(`overdue-scan ${reason}: 0`);
      return { updated: 0 };
    }
    const ids = pending.map((t) => t.id);
    await this.prisma.$transaction([
      this.prisma.followUpTask.updateMany({
        where: { id: { in: ids } },
        data: { status: 'overdue' },
      }),
      this.prisma.taskEvent.createMany({
        data: pending.map((t) => ({
          taskId: t.id,
          actorId: null,
          fromStatus: t.status,
          toStatus: 'overdue',
          detail: `系统自动逾期（${reason}）`,
        })),
      }),
    ]);
    this.log.log(`overdue-scan ${reason}: ${ids.length}`);
    return { updated: ids.length };
  }
}
