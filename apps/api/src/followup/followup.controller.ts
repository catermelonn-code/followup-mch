import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators';
import { CompleteDto } from '../auth/dto';
import { AuthedUser } from '../util';
import { FollowupService } from './followup.service';

@Controller('followups')
export class FollowupController {
  constructor(private followup: FollowupService) {}

  @Get('template')
  async template(@Res() res: Response) {
    const buf = await this.followup.template();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="followup-template.xlsx"',
    );
    res.send(buf);
  }

  @Get('export')
  async export(
    @CurrentUser() user: AuthedUser,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const buf = await this.followup.export(user, q);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="followups.xlsx"',
    );
    res.send(buf);
  }

  @Get('types')
  types(@CurrentUser() user: AuthedUser) {
    return this.followup.types(user);
  }

  @Get()
  list(@CurrentUser() user: AuthedUser, @Query() q: any) {
    return this.followup.list(user, q);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.followup.detail(user, id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  import(
    @CurrentUser() user: AuthedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.followup.importExcel(user, file);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteDto,
  ) {
    return this.followup.complete(user, id, dto.resultText);
  }
}
