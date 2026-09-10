import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators';
import { SessionsService } from '../sessions/sessions.service';
import { PaymentsService } from '../payments/payments.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Offline sync: the mobile app buffers operations with a client-generated
 * idempotency key. The server executes each op at-most-once (unique index on
 * the key). Duplicates return the existing record instead of re-applying.
 */
@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/sync')
export class SyncController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly paymentsService: PaymentsService,
    private readonly tubewellsService: TubewellsService,
  ) {}

  @Post('batch')
  async batch(@CurrentUser() user: AuthUser, @Body('operations') operations: any[] = []) {
    if (!Array.isArray(operations) || operations.length > 100) {
      throw new BadRequestException('operations must be an array (max 100)');
    }
    const results: Array<Record<string, unknown>> = [];
    for (const op of operations) {
      const key = op?.idempotencyKey;
      if (!key || typeof key !== 'string' || key.length < 8) {
        results.push({ status: 'invalid', op: op?.op, idempotencyKey: key || null, error: 'Missing idempotencyKey' });
        continue;
      }
      try {
        const data = await this.dispatch(user, op);
        results.push({ status: 'ok', op: op?.op, idempotencyKey: key, data });
      } catch (err: any) {
        results.push({
          status: 'error',
          op: op?.op,
          idempotencyKey: key,
          error: err?.response?.message || err?.message || 'Unknown error',
        });
      }
    }
    return results;
  }

  private async dispatch(user: AuthUser, op: any): Promise<any> {
    switch (op?.op) {
      case 'start_session':
        return this.sessionsService.start(user.id, {
          ...op.payload,
          idempotencyKey: op.idempotencyKey,
          startDatetime: op.payload?.startDatetime ? new Date(op.payload.startDatetime) : undefined,
        });
      case 'stop_session':
        return this.sessionsService.stop(
          user.id,
          op.payload.sessionId,
          op.payload?.endDatetime ? new Date(op.payload.endDatetime) : undefined,
        );
      case 'customer_start_session':
        return this.sessionsService.startForCustomer(user.id, {
          ...op.payload,
          idempotencyKey: op.idempotencyKey,
        });
      case 'customer_stop_session':
        return this.sessionsService.stopForCustomer(
          user.id,
          op.payload.sessionId,
          op.payload?.endDatetime ? new Date(op.payload.endDatetime) : undefined,
        );
      case 'manual_session':
        return this.sessionsService.createManual(user.id, {
          ...op.payload,
          idempotencyKey: op.idempotencyKey,
          startDatetime: new Date(op.payload.startDatetime),
          endDatetime: new Date(op.payload.endDatetime),
        });
      case 'payment_request':
        return this.paymentsService.createPaymentRequest(user.id, {
          ...op.payload,
          idempotencyKey: op.idempotencyKey,
        });
      case 'record_payment':
        return this.paymentsService.recordPayment(user.id, {
          ...op.payload,
          idempotencyKey: op.idempotencyKey,
          source: 'manual',
        });
      case 'cancel_session':
        return this.sessionsService.cancel(user.id, op.payload.sessionId);
      default:
        throw new BadRequestException(`Unknown operation: ${op?.op}`);
    }
  }
}