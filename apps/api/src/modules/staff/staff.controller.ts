import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/public.decorator';
import { StaffService } from './staff.service';

@Controller('auth')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Post('login')
  login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: Response) {
    return this.staffService.login(body.email, body.password, res);
  }

  @Public()
  @Post('refresh')
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.staffService.refresh(req, res);
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.staffService.logout(req, res);
  }

  @Get('staff')
  listStaff() {
    return this.staffService.list();
  }

  @Post('staff')
  createStaff(@Body() body: { email: string; name: string; password: string; role: 'ADMIN' | 'AGENT' }) {
    return this.staffService.create(body);
  }
}
