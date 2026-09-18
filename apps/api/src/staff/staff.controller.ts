import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CurrentUser, Roles } from '../auth/decorators';
import { RolesGuard } from '../auth/roles.guard';
import { AuthedUser } from '../util';
import { StaffService } from './staff.service';

@Controller()
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get('departments')
  departments() {
    return this.staff.departments();
  }

  @Get('staff')
  list(@CurrentUser() user: AuthedUser, @Query('keyword') keyword?: string) {
    return this.staff.list(user, keyword);
  }

  @Get('staff/owners')
  owners(@CurrentUser() user: AuthedUser) {
    return this.staff.ownersForFilter(user);
  }

  @Get('staff/template')
  @UseGuards(RolesGuard)
  @Roles('sys_admin', 'dept_admin')
  async template(@Res() res: Response) {
    const buf = await this.staff.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="staff-template.xlsx"',
    );
    res.send(buf);
  }

  @Post('staff/import')
  @UseGuards(RolesGuard)
  @Roles('sys_admin', 'dept_admin')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  import(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.staff.importExcel(user, file);
  }

  @Get('imports')
  imports(@CurrentUser() user: AuthedUser, @Query('kind') kind?: string) {
    return this.staff.importBatches(user, kind);
  }

  @Get('imports/:id')
  importRows(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.staff.importRows(user, id);
  }
}
