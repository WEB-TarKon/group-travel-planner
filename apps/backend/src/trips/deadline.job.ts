import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma.service";

@Injectable()
export class DeadlineJob {
    constructor(private prisma: PrismaService) {}

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
        }
    }
}
