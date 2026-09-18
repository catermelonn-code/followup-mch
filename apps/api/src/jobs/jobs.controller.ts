import { Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { OverdueService } from './overdue.service';

@Controller('jobs')
@UseGuards(RolesGuard)
export class JobsController {
  constructor(private overdue: OverdueService) {}

  @Post('overdue-scan')
  @Roles('sys_admin')
  scan() {
    return this.overdue.scan('manual');
  }
}
