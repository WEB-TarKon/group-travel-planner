import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import {PrismaService} from "./prisma.service";
import { TripsModule } from './trips/trips.module';
import { PrismaModule } from "./prisma.module";
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [PrismaModule, TripsModule, AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    UsersModule,
    NotificationsModule,],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
