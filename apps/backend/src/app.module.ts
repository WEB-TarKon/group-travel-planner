import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { HealthController } from "./health.controller";
import {PrismaService} from "./prisma.service";
import { TripsModule } from './trips/trips.module';
import { PrismaModule } from "./prisma.module";

@Module({
  imports: [PrismaModule, TripsModule],
  controllers: [AppController, HealthController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
