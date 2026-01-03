import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SendMessageDto } from "./dto/send-message.dto";

@Injectable()
export class ChatService {
    constructor(private prisma: PrismaService) {}

    async ensureMember(tripId: string, userId: string) {
        const m = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!m) throw new Error("Forbidden");
    }

    async list(tripId: string, userId: string, cursor?: string) {
        await this.ensureMember(tripId, userId);

        const take = 50;

        const items = await this.prisma.tripChatMessage.findMany({
            where: { tripId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take,
            ...(cursor
                ? {
                    skip: 1,
                    cursor: { id: cursor },
                }
                : {}),
            include: {
                sender: {
                    select: { id: true, name: true, email: true, login: true },
                },
                mentions: {
                    select: { userId: true },
                },
            },
        });

        // повертаємо у зручному порядку (старі -> нові)
        return items.reverse();
    }

    async send(tripId: string, userId: string, dto: SendMessageDto) {
        await this.ensureMember(tripId, userId);

        if (!dto.text?.trim() && !dto.fileUrl) {
            throw new Error("Empty message");
        }

        const msg = await this.prisma.tripChatMessage.create({
            data: {
                tripId,
                senderId: userId,
                text: dto.text?.trim() ?? null,
                fileUrl: dto.fileUrl ?? null,
                fileName: dto.fileName ?? null,
                fileMime: dto.fileMime ?? null,
                replyToId: dto.replyToId ?? null,
                mentions: dto.mentions?.length
                    ? {
                        createMany: {
                            data: dto.mentions.map((id) => ({ userId: id })),
                            skipDuplicates: true,
                        },
                    }
                    : undefined,
            },
            include: {
                sender: { select: { id: true, name: true, email: true, login: true } },
                mentions: { select: { userId: true } },
            },
        });

        // read-state: якщо в юзера ще нема запису — створимо (щоб потім unread рахувати стабільно)
        await this.prisma.tripChatReadState.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: {},
            create: { tripId, userId },
        });

        return msg;
    }

    async markRead(tripId: string, userId: string, lastReadMessageId?: string) {
        await this.ensureMember(tripId, userId);

        await this.prisma.tripChatReadState.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: {
                lastReadAt: new Date(),
                lastReadMessageId: lastReadMessageId ?? undefined,
            },
            create: {
                tripId,
                userId,
                lastReadAt: new Date(),
                lastReadMessageId: lastReadMessageId ?? null,
            },
        });

        return { ok: true };
    }

    async unreadCount(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        const state = await this.prisma.tripChatReadState.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });

        const lastReadAt = state?.lastReadAt ?? new Date(0);

        const cnt = await this.prisma.tripChatMessage.count({
            where: {
                tripId,
                deletedAt: null,
                createdAt: { gt: lastReadAt },
                senderId: { not: userId },
            },
        });

        return { unread: cnt };
    }

    async search(tripId: string, userId: string, q: string) {
        await this.ensureMember(tripId, userId);

        const query = q.trim();
        if (!query) return [];

        return this.prisma.tripChatMessage.findMany({
            where: {
                tripId,
                deletedAt: null,
                text: { contains: query, mode: "insensitive" },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
            include: {
                sender: { select: { id: true, name: true, email: true, login: true } },
                mentions: { select: { userId: true } },
            },
        });
    }
}
