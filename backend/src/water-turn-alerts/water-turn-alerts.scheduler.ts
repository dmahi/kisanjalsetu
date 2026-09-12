import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WaterTurnAlertsService } from './water-turn-alerts.service';

@Injectable()
export class WaterTurnScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WaterTurnScheduler');
  private interval?: ReturnType<typeof setInterval>;
  private processing = false;

  constructor(
    private readonly alertService: WaterTurnAlertsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const ms = (this.config.get<number>('WATER_TURN_CHECK_INTERVAL_SECONDS', 30) as number) * 1000;
    this.logger.log(`WaterTurnScheduler started — checking every ${ms / 1000}s`);
    this.interval = setInterval(() => {
      void this.tick();
    }, ms);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.alertService.processExpired();
    } catch (err: unknown) {
      this.logger.error('WaterTurnScheduler tick failed', err as any);
    } finally {
      this.processing = false;
    }
  }
}