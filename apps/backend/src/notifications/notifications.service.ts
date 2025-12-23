import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) {}

    create(userId: string, title: string, message: string) {
        return this.prisma.notification.create({ data: { userId, title, message } });
    }

    list(userId: string) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }

    markRead(userId: string, id: string) {
        return this.prisma.notification.updateMany({
            where: { id, userId },
            data: { isRead: true, readAt: new Date() },
        });
    }
}
