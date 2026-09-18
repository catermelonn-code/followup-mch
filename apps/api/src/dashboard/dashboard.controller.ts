import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators';
import { AuthedUser } from '../util';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get('summary')
  summary(
    @CurrentUser() user: AuthedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboard.summary(user, from, to);
  }
}
