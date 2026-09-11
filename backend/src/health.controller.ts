import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

@Controller('api')
export class HealthController {
  @Public()
  @Get('health')
  health(): { status: string; time: string } {
    return { status: 'ok', time: new Date().toISOString() };
  }
}