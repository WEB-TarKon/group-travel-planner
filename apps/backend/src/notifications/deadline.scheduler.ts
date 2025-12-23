import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma.service";
import {NotificationType} from "@prisma/client";

@Injectable()
export class DeadlineScheduler {
    constructor(private prisma: PrismaService) {}

    @Cron("*/60 * * * * *") // раз на хвилину
    async tick() {
        const now = new Date();
        const finances = await this.prisma.tripFinance.findMany({
            include: { trip: { select: { id: true, organizerId: true, title: true } } },
        });

        for (const f of finances) {
            const msLeft = f.payDeadlineUser.getTime() - now.getTime();

            const marks = [
                { ms: 2 * 60 * 60 * 1000, label: "2 години" },
                { ms: 1 * 60 * 60 * 1000, label: "1 година" },
                { ms: 30 * 60 * 1000, label: "30 хв" },
            ];

            for (const m of marks) {
                // “вікно” 60 секунд, щоб не дублювати
                if (msLeft <= m.ms && msLeft > m.ms - 60 * 1000) {
                    await this.prisma.notification.create({
                        data: {
                            userId: f.trip.organizerId,
                            tripId: f.trip.id,
                            type: NotificationType.DEADLINE_REMINDER_ORGANIZER,
                            title: "Наближається дедлайн оплати",
                            message: `До дедлайну оплати залишилось ${m.label}. Перевір платежі по подорожі "${f.trip.title}".`,
                        },
                    });
                }
            }
        }
    }
}
