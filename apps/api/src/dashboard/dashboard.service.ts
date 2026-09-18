import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  AuthedUser,
  isChildType,
  isMaternalType,
  todayDate,
  visibleWhere,
} from '../util';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary(user: AuthedUser, from?: string, to?: string) {
    const scope = visibleWhere(user) as Record<string, unknown>;
    const dateWhere: Record<string, unknown> = { ...scope };
    if (from || to) {
      dateWhere.planDate = {};
      if (from) (dateWhere.planDate as any).gte = new Date(`${from}T00:00:00.000Z`);
      if (to) (dateWhere.planDate as any).lte = new Date(`${to}T00:00:00.000Z`);
    }

    const [total, pending, done, overdue, allForCharts, typed] = await Promise.all([
      this.prisma.followUpTask.count({ where: dateWhere }),
      this.prisma.followUpTask.count({
        where: { ...dateWhere, status: 'pending' },
      }),
      this.prisma.followUpTask.count({
        where: { ...dateWhere, status: 'done' },
      }),
      this.prisma.followUpTask.count({
        where: { ...dateWhere, status: 'overdue' },
      }),
      this.prisma.followUpTask.findMany({
        where: dateWhere,
        select: {
          planDate: true,
          status: true,
          followUpType: true,
          dept: { select: { name: true } },
        },
      }),
      this.prisma.followUpTask.groupBy({
        by: ['followUpType'],
        where: {
          ...scope,
          OR: [
            { status: 'overdue' },
            { status: 'pending', planDate: todayDate() },
          ],
        },
        _count: { _all: true },
      }),
    ]);

    const completionRate =
      total === 0 ? 0 : Math.round((done / total) * 1000) / 10;

    const monthMap = new Map<string, number>();
    const now = todayDate();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, 0);
    }
    const childStatus = { pending: 0, done: 0, overdue: 0 };
    const deptMap = new Map<string, number>();

    for (const t of allForCharts) {
      const d = t.planDate;
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (isMaternalType(t.followUpType) && monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
      }
      if (isChildType(t.followUpType)) {
        childStatus[t.status] += 1;
      }
      deptMap.set(t.dept.name, (deptMap.get(t.dept.name) || 0) + 1);
    }

    const maternalTrend = [...monthMap.entries()].map(([month, count]) => ({
      month,
      label: `${Number(month.slice(5))}月`,
      count,
    }));

    const childTotal =
      childStatus.pending + childStatus.done + childStatus.overdue;
    const childStatusChart = [
      { status: 'pending', label: '待随访', count: childStatus.pending },
      { status: 'done', label: '已随访', count: childStatus.done },
      { status: 'overdue', label: '已逾期', count: childStatus.overdue },
    ];

    const deptRanking = [...deptMap.entries()]
      .map(([deptName, count]) => ({ deptName, count }))
      .sort((a, b) => b.count - a.count);

    const todayTodos = typed
      .map((r) => ({ type: r.followUpType, count: r._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      pending,
      done,
      overdue,
      completionRate,
      childTotal,
      maternalTrend,
      childStatus: childStatusChart,
      deptRanking,
      todayTodos,
    };
  }
}
