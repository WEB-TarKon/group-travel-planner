import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "@prisma/client";

@Injectable()
export class DeadlineJob {
    constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

    @Cron("*/60 * * * * *")
    async run() {
        const now = new Date();

        const finances = await this.prisma.tripFinance.findMany({
            where: {
                payDeadlineOrganizer: { lte: now },
            },
            select: { tripId: true },
        });

        for (const f of finances) {
            const tripId = f.tripId;

            const badPayments = await this.prisma.payment.findMany({
                where: {
                    tripId,
                    status: { in: ["PENDING", "REJECTED"] },
                },
                select: { userId: true },
            });

            const badUserIds = badPayments.map((p) => p.userId);

            if (badUserIds.length > 0) {
                await this.prisma.tripMember.deleteMany({
                    where: {
                        tripId,
                        userId: { in: badUserIds },
                        role: "PARTICIPANT",
                    },
                });

                await this.prisma.payment.deleteMany({
                    where: {
                        tripId,
                        userId: { in: badUserIds },
                    },
                });
            }

            if (badUserIds.length > 0) {
                await this.prisma.notification.createMany({
                    data: badUserIds.map((uid) => ({
                        userId: uid,
                        tripId,
                        type: NotificationType.MEMBER_EXCLUDED,
                        title: "Виключено з подорожі",
                        message: "Вас було виключено з подорожі через несплату до дедлайну організатора.",
                    })),
                });

                // повідомлення організатору (summary)
                const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
                if (trip) {
                    await this.notifications.create(trip.organizerId, {
                        type: NotificationType.DEADLINE_REMINDER_ORGANIZER,
                        tripId,
                        title: "Дедлайн завершено: учасників виключено",
                        message: `Автоматично виключено ${badUserIds.length} учасників через несплату.`,
                    });
                }
            }
        }
    }
}
