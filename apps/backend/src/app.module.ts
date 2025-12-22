import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import {PrismaService} from "./prisma.service";
import { TripsModule } from './trips/trips.module';
import { PrismaModule } from "./prisma.module";
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, TripsModule, AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
