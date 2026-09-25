import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/water',
})
@Injectable()
export class WaterGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WaterGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> set of socketIds
  private socketUsers = new Map<string, string>(); // socketId -> userId

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      }) as { sub: string; role: string };

      client.userId = payload.sub;
      client.userRole = payload.role;

      // Track user's sockets
      const userId = client.userId;
      const userRole = client.userRole;
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);
      this.socketUsers.set(client.id, userId);

      // Join user's personal room
      client.join(`user:${userId}`);

      // Join role-based rooms
      client.join(`role:${userRole}`);

      if (userRole === 'farmer') {
        // This would need tubewell membership info - could be fetched from DB
        // For now, they'll join tubewell rooms when they subscribe
      }

      this.logger.log(`Client connected: ${client.id} (user: ${userId}, role: ${userRole})`);
    } catch (err) {
      this.logger.warn(`Invalid token for client ${client.id}: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    const userId = this.socketUsers.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.socketUsers.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTubewell')
  handleJoinTubewell(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { tubewellId: string }) {
    if (!client.userId) return { error: 'Not authenticated' };
    client.join(`tubewell:${data.tubewellId}`);
    this.logger.log(`User ${client.userId} joined tubewell room: ${data.tubewellId}`);
    return { success: true };
  }

  @SubscribeMessage('leaveTubewell')
  handleLeaveTubewell(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: { tubewellId: string }) {
    client.leave(`tubewell:${data.tubewellId}`);
    return { success: true };
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { timestamp: Date.now() };
  }

  // Public methods to emit events from services
  emitWaterStarted(tubewellId: string, data: {
    sessionId: string;
    tubewellId: string;
    tubewellName: string;
    customerId: string;
    fieldId?: string;
    fieldName?: string;
    startTime: Date;
    ratePerHour: number | string;
  }) {
    this.server.to(`tubewell:${tubewellId}`).emit('waterStarted', data);
    this.server.to(`user:${data.customerId}`).emit('waterStarted', data);
    this.logger.log(`Water started event emitted for tubewell ${tubewellId}`);
  }

  emitWaterStopped(tubewellId: string, data: {
    sessionId: string;
    tubewellId: string;
    tubewellName: string;
    customerId: string;
    fieldId?: string;
    fieldName?: string;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    totalAmount: number | string;
    ratePerHour: number | string;
  }) {
    this.server.to(`tubewell:${tubewellId}`).emit('waterStopped', data);
    this.server.to(`user:${data.customerId}`).emit('waterStopped', data);
    this.logger.log(`Water stopped event emitted for tubewell ${tubewellId}`);
  }

  emitTimerTick(tubewellId: string, data: {
    sessionId: string;
    elapsedSeconds: number;
    elapsedMinutes: number;
    currentCost: number;
  }) {
    this.server.to(`tubewell:${tubewellId}`).emit('timerTick', data);
  }

  emitWaterStartedToOwner(ownerId: string, data: any) {
    this.server.to(`user:${ownerId}`).emit('waterStarted', data);
  }

  emitWaterStoppedToOwner(ownerId: string, data: any) {
    this.server.to(`user:${ownerId}`).emit('waterStopped', data);
  }

  private emitTo(rooms: string[], event: string, data: any) {
    for (const room of rooms) {
      this.server.to(room).emit(event, data);
    }
  }

  /** Farmer created a new water request → owner + tubewell room. */
  emitWaterRequestCreated(data: {
    requestId: string;
    tubewellId: string;
    ownerId?: string | null;
    customerId: string;
    customerName?: string | null;
    fieldId: string;
    fieldName?: string | null;
    cropName?: string | null;
    requestedDurationMinutes?: number;
    preferredStartTime?: string | null;
    note?: string | null;
    createdAt?: unknown;
  }) {
    this.emitTo(
      [data.ownerId ? `user:${data.ownerId}` : '', `tubewell:${data.tubewellId}`].filter(Boolean),
      'waterRequestCreated',
      data,
    );
  }

  /** Owner accepted a request → farmer + tubewell room. */
  emitWaterRequestAccepted(data: {
    requestId: string;
    tubewellId: string;
    customerId: string;
    customerName?: string | null;
    fieldName?: string | null;
    cropName?: string | null;
    queuePosition: number;
  }) {
    this.emitTo(
      [`user:${data.customerId}`, `tubewell:${data.tubewellId}`].filter(Boolean),
      'waterRequestAccepted',
      data,
    );
  }

  /** Owner rejected a request → farmer + tubewell room. */
  emitWaterRequestRejected(data: {
    requestId: string;
    tubewellId: string;
    customerId: string;
    fieldName?: string | null;
    cropName?: string | null;
    rejectionReason?: string | null;
  }) {
    this.emitTo(
      [`user:${data.customerId}`, `tubewell:${data.tubewellId}`].filter(Boolean),
      'waterRequestRejected',
      data,
    );
  }

  /** Farmer cancelled a request → owner + farmer + tubewell room. */
  emitWaterRequestCancelled(data: {
    requestId: string;
    tubewellId: string;
    ownerId?: string | null;
    customerId: string;
    customerName?: string | null;
    fieldName?: string | null;
  }) {
    this.emitTo(
      [
        data.ownerId ? `user:${data.ownerId}` : '',
        `user:${data.customerId}`,
        `tubewell:${data.tubewellId}`,
      ].filter(Boolean),
      'waterRequestCancelled',
      data,
    );
  }

  emitWaterQueueChanged(data: {
    tubewellId: string;
    reason: string;
    generatedAt: Date;
    active: Record<string, unknown> | null;
    waiting: Array<Record<string, unknown>>;
  }) {
    this.server.to(`tubewell:${data.tubewellId}`).emit('waterQueueChanged', data);
  }

  /** Water turn alert sent / retried / delayed → farmer + tubewell room. */
  emitWaterTurnAlertSent(data: {
    alertId: string;
    tubewellId: string;
    targetCustomerId: string;
    farmerName?: string | null;
    tubewellName?: string | null;
    fieldName?: string | null;
    cropName?: string | null;
    responseDeadlineAt?: string | null;
    attemptNumber: number;
    maxAttempts: number;
    estimatedRemainingMinutes?: number;
    type?: string;
  }) {
    this.emitTo(
      [`user:${data.targetCustomerId}`, `tubewell:${data.tubewellId}`].filter(Boolean),
      'waterTurnAlertSent',
      data,
    );
  }

  /** Farmer responded / alert resolved → owner + tubewell room. */
  emitWaterTurnAlertStatus(data: {
    alertId: string;
    tubewellId: string;
    ownerId?: string | null;
    targetCustomerId: string;
    farmerName?: string | null;
    tubewellName?: string | null;
    status: string;
    response?: string | null;
    type?: string;
  }) {
    this.emitTo(
      [
        data.ownerId ? `user:${data.ownerId}` : '',
        `user:${data.targetCustomerId}`,
        `tubewell:${data.tubewellId}`,
      ].filter(Boolean),
      'waterTurnAlertStatus',
      data,
    );
  }

  isUserOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
