import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuthedUser, todayDate, visibleWhere } from '../util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(username: string, password: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { username: username.trim() },
      include: { dept: true },
    });
    if (!staff || !staff.active) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const ok = await bcrypt.compare(password, staff.passwordHash);
    if (!ok) throw new UnauthorizedException('用户名或密码错误');
    const user: AuthedUser = {
      id: staff.id,
      name: staff.name,
      username: staff.username,
      role: staff.role,
      deptId: staff.deptId,
      deptName: staff.dept.name,
      mustChangePassword: staff.mustChangePassword,
    };
    const token = await this.jwt.signAsync({ sub: staff.id, role: staff.role });
    const notifications = await this.notifications(user);
    return { token, user: { ...user, notifications } };
  }

  async me(user: AuthedUser) {
    const notifications = await this.notifications(user);
    return { ...user, notifications };
  }

  async changePassword(
    user: AuthedUser,
    oldPassword: string,
    newPassword: string,
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { id: user.id } });
    if (!staff) throw new UnauthorizedException();
    const ok = await bcrypt.compare(oldPassword, staff.passwordHash);
    if (!ok) throw new BadRequestException('原密码不正确');
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与原密码相同');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.staff.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    });
    return { ok: true };
  }

  async notifications(user: AuthedUser) {
    const scope = visibleWhere(user);
    const today = todayDate();
    const [overdue, dueToday, typed] = await Promise.all([
      this.prisma.followUpTask.count({
        where: { ...scope, status: 'overdue' },
      }),
      this.prisma.followUpTask.count({
        where: { ...scope, status: 'pending', planDate: today },
      }),
      this.prisma.followUpTask.groupBy({
        by: ['followUpType'],
        where: {
          ...scope,
          OR: [{ status: 'overdue' }, { status: 'pending', planDate: today }],
        },
        _count: { _all: true },
      }),
    ]);
    const byType = typed
      .map((r) => ({ type: r.followUpType, count: r._count._all }))
      .sort((a, b) => b.count - a.count);
    return {
      badge: overdue + dueToday,
      overdue,
      dueToday,
      byType,
    };
  }
}
