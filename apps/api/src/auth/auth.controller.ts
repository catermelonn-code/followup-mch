import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { ChangePasswordDto, LoginDto } from './dto';
import { AuthedUser } from '../util';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthedUser) {
    return this.auth.me(user);
  }

  @Post('change-password')
  changePassword(
    @CurrentUser() user: AuthedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(user, dto.oldPassword, dto.newPassword);
  }
}
