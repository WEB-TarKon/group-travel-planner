import { Injectable, Logger } from "@nestjs/common";
import TelegramBot from "node-telegram-bot-api";
import { PrismaService } from "../prisma.service";

@Injectable()
export class TelegramService {
    private readonly log = new Logger(TelegramService.name);
    private bot: TelegramBot | null = null;

    constructor(private prisma: PrismaService) {}

    init() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            this.log.warn("TELEGRAM_BOT_TOKEN is not set. Telegram disabled.");
            return;
        }

        // polling — найпростіше для диплома/демо (без nginx/https webhooks)
        this.bot = new TelegramBot(token, { polling: true });

        this.bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
            const chatId = String(msg.chat.id);
            const code = (match?.[1] || "").trim();

            if (!code) {
                await this.bot?.sendMessage(
                    chatId,
                    "Привіт! Щоб підключити сповіщення, відкрий сайт → Профіль → Підключити Telegram і скопіюй код сюди: /start <код>."
                );
                return;
            }

            const user = await this.prisma.user.findFirst({
                where: { telegramLinkCode: code },
                select: { id: true, email: true, name: true },
            });

            if (!user) {
                await this.bot?.sendMessage(chatId, "Код не знайдено або він протермінований. Згенеруй новий код на сайті.");
                return;
            }

            await this.prisma.user.update({
                where: { id: user.id },
                data: { telegramChatId: chatId, telegramLinkCode: null },
            });

            await this.bot?.sendMessage(
                chatId,
                `Готово ✅ Telegram підключено для акаунта ${user.name || user.email}. Тепер ти будеш отримувати сповіщення про подорожі.`
            );
        });

        this.log.log("Telegram bot started (polling).");
    }

    async sendToUser(userId: string, text: string) {
        if (!this.bot) return;
        const u = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { telegramChatId: true },
        });
        if (!u?.telegramChatId) return;

        try {
            await this.bot.sendMessage(u.telegramChatId, text);
        } catch (e) {
            this.log.warn(`Failed to send telegram message to userId=${userId}`);
        }
    }

    async sendMessageToChatId(chatId: string, text: string) {
        if (!this.bot) return;
        await this.bot.sendMessage(chatId, text);
    }
}
