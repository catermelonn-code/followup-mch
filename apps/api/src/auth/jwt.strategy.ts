import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { AuthedUser } from '../util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'mch-followup-dev-secret',
    });
  }

  async validate(payload: { sub: number }): Promise<AuthedUser> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
      include: { dept: true },
    });
    if (!staff || !staff.active) {
      throw new UnauthorizedException('账号不可用');
    }
    return {
      id: staff.id,
      name: staff.name,
      username: staff.username,
      role: staff.role,
      deptId: staff.deptId,
      deptName: staff.dept.name,
      mustChangePassword: staff.mustChangePassword,
    };
  }
}
