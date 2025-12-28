import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { NotificationType } from "@prisma/client";

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) {}

    create(userId: string, data: { type: NotificationType; title: string; message: string; tripId?: string | null }) {
        return this.prisma.notification.create({
            data: {
                userId,
                tripId: data.tripId ?? null,
                type: data.type,
                title: data.title,
                message: data.message,
            },
        });
    }

    list(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }

    unreadCount(userId: string) {
        return this.prisma.notification.count({
            where: { userId, isRead: false },
        });
    }

    markRead(userId: string, id: string) {
        return this.prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true, readAt: new Date() },
        });
    }

    markAllRead(userId: string) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
    }
}
