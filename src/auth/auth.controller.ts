import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(
    @Body() body: { email: string; password: string; name?: string },
  ) {
    return this.authService.signup(body?.email, body?.password, body?.name);
  }

  @Post('login')
  login(
    @Body() body: { email: string; password: string },
  ) {
    return this.authService.login(body?.email, body?.password);
  }

  @Get('users')
  users(
    @Query('excludeEmail') excludeEmail?: string,
  ) {
    return this.authService.listUsers(excludeEmail);
  }
}
