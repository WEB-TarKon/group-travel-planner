import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import { PrismaService } from "../prisma.service";
import { AuthModule } from "../auth/auth.module";
import { ChatNotifyService } from "./chat-notify.service";
import { TelegramModule } from "../telegram/telegram.module";

@Module({
    imports: [AuthModule, TelegramModule],
    controllers: [ChatController],
    providers: [ChatService, PrismaService, ChatGateway, ChatNotifyService],
})
export class ChatModule {}
