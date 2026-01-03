import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma.service";
import { TelegramService } from "../telegram/telegram.service";

@Injectable()
export class ChatNotifyService {
    constructor(private prisma: PrismaService, private tg: TelegramService) {}

    @Cron("*/30 * * * *")
    async notifyUnread() {
        // беремо всіх користувачів, у кого є telegramChatId (тобто можна писати в тг)
        const users = await this.prisma.user.findMany({
            where: { telegramChatId: { not: null } },
            select: { id: true, telegramChatId: true },
        });

        const now = new Date();
        const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);

        for (const u of users) {
            // знайдемо всі readState де є непрочитані і де останнє сповіщення було > 30 хв тому
            const states = await this.prisma.tripChatReadState.findMany({
                where: {
                    userId: u.id,
                    OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: thirtyMinAgo } }],
                },
                select: { tripId: true, lastReadAt: true },
            });

            for (const s of states) {
                const unread = await this.prisma.tripChatMessage.findMany({
                    where: {
                        tripId: s.tripId,
                        deletedAt: null,
                        createdAt: { gt: s.lastReadAt },
                        senderId: { not: u.id },
                    },
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: { sender: { select: { name: true, login: true, email: true } }, trip: { select: { title: true } } },
                });

                if (!unread.length) continue;

                const last = unread[0];
                const from = last.sender?.name || last.sender?.login || last.sender?.email || "Учасник";
                const text = (last.text ?? "").slice(0, 120);

                await this.tg.sendMessageToChatId(String(u.telegramChatId),
                    `💬 Нові повідомлення у подорожі: ${last.trip.title}
Від: ${from}
${text ? `Текст: ${text}` : "Є новий файл/медіа"}
(Сповіщення приходять раз на 30 хв, якщо є нові непрочитані)`);

                await this.prisma.tripChatReadState.update({
                    where: { tripId_userId: { tripId: s.tripId, userId: u.id } },
                    data: { lastNotifiedAt: now },
                });
            }
        }
    }
}
