import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CropsModule } from './crops/crops.module';
import { FieldsModule } from './fields/fields.module';
import { TubewellsModule } from './tubewells/tubewells.module';
import { SessionsModule } from './sessions/sessions.module';
import { PaymentsModule } from './payments/payments.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { SyncModule } from './sync/sync.module';
import { UploadsModule } from './uploads/uploads.module';
import { WaterModule } from './water/water.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri =
          config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/tubwell') || '';
        const isAtlas = uri.includes('mongodb+srv://');
        return {
          uri,
          serverSelectionTimeoutMS: isAtlas ? 15000 : 5000,
          retryAttempts: 2,
          retryDelay: 1000,
        };
      },
    }),
    UsersModule,
    AuthModule,
    CropsModule,
    FieldsModule,
    TubewellsModule,
    SessionsModule,
    PaymentsModule,
    ActivityLogsModule,
    NotificationsModule,
    ReportsModule,
    AdminModule,
    SyncModule,
    UploadsModule,
    WaterModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}