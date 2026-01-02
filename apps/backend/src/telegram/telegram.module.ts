import { Module, OnModuleInit } from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import { TelegramController } from "./telegram.controller";
import { PrismaService } from "../prisma.service";
import { AuthModule } from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [TelegramController],
    providers: [TelegramService, PrismaService],
    exports: [TelegramService],
})
export class TelegramModule implements OnModuleInit {
    constructor(private tg: TelegramService) {}

    onModuleInit() {
        this.tg.init();
    }
}
