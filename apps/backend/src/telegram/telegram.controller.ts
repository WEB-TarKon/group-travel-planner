import { Controller, Post, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma.service";

function genCode() {
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

@UseGuards(JwtGuard)
@Controller("telegram")
export class TelegramController {
    constructor(private prisma: PrismaService) {}

    @Post("link-code")
    async createLinkCode(@Req() req: any) {
        const code = genCode();

        await this.prisma.user.update({
            where: { id: req.user.id },
            data: { telegramLinkCode: code },
        });

        return { code };
    }

    @Post("disconnect")
    async disconnect(@Req() req: any) {
        await this.prisma.user.update({
            where: { id: req.user.id },
            data: { telegramChatId: null, telegramLinkCode: null },
        });
        return { ok: true };
    }
}
