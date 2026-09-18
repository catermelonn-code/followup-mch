import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { FollowupModule } from './followup/followup.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma.module';
import { StaffModule } from './staff/staff.module';

@Module({
  controllers: [HealthController],
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    AuthModule,
    StaffModule,
    FollowupModule,
    DashboardModule,
    JobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

