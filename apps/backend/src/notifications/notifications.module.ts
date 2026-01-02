import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import {AuthModule} from "../auth/auth.module";
import {PrismaService} from "../prisma.service";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
  imports: [AuthModule, TelegramModule],
  providers: [NotificationsService, PrismaService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
