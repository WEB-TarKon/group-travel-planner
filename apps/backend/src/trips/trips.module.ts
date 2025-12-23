import { Module } from '@nestjs/common';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { PrismaModule } from '../prisma.module';
import {AuthModule} from "../auth/auth.module";
import {NotificationsModule} from "../notifications/notifications.module";
import {PrismaService} from "../prisma.service";
import {DeadlineJob} from "./deadline.job";

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  providers: [TripsService, PrismaService, DeadlineJob],
  controllers: [TripsController]
})
export class TripsModule {}
