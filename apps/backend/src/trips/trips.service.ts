import { PrismaService } from "../prisma.service";
import {NotificationType, PaymentStatus, TripStatus} from "@prisma/client";
import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from "@nestjs/common";
import {NotificationsService} from "../notifications/notifications.service";

@Injectable()
export class TripsService {
    constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

    listTrips() {
        return this.prisma.trip.findMany({ orderBy: { createdAt: "desc" } });
    }

    getTrip(id: string) {
        return this.prisma.trip.findUnique({
            where: { id },
            include: {
                waypoints: { orderBy: { order: "asc" } },
                members: true
            },
        });
    }

    async createTrip(data: { title: string; isPublic?: boolean; organizerId: string }) {
        return this.prisma.trip.create({
            data: {
                title: data.title,
                isPublic: data.isPublic ?? false,
                organizerId: data.organizerId,
                members: {
                    create: {
                        userId: data.organizerId,
                        role: "ORGANIZER",
                        status: "ACTIVE",
                    },
                },
            },
        });
    }

    async upsertWaypoints(tripId: string, waypoints: Array<{ order: number; lat: number; lng: number; title?: string }>) {
        const existing = await this.prisma.waypoint.findMany({
            where: { tripId },
            orderBy: { order: "asc" },
        });

        if (existing.length >= 2 && waypoints.length >= 2) {
            const startOld = existing[0];
            const endOld = existing[existing.length - 1];

            const startNew = waypoints[0];
            const endNew = waypoints[waypoints.length - 1];

            const startChanged =
                startNew.lat !== startOld.lat || startNew.lng !== startOld.lng || (startNew.title ?? "") !== (startOld.title ?? "");
            const endChanged =
                endNew.lat !== endOld.lat || endNew.lng !== endOld.lng || (endNew.title ?? "") !== (endOld.title ?? "");

            if (startChanged || endChanged) {
                throw new BadRequestException("Початкову та кінцеву точки змінювати не можна");
            }
        }
        return this.prisma.$transaction([
            this.prisma.waypoint.deleteMany({ where: { tripId } }),
            this.prisma.waypoint.createMany({
                data: waypoints.map((w) => ({
                    tripId,
                    order: w.order,
                    lat: w.lat,
                    lng: w.lng,
                    title: w.title,
                })),
            }),
        ]);
    }

    listMyTrips(userId: string) {
        return this.prisma.trip.findMany({
            where: {
                OR: [
                    { organizerId: userId },
                    { members: { some: { userId, status: "ACTIVE" } } },
                ],
            },
            orderBy: { createdAt: "desc" },
        });
    }

    listPublicTrips() {
        return this.prisma.trip.findMany({
            where: { isPublic: true },
            orderBy: { createdAt: "desc" },
            select: { id: true, title: true, isPublic: true, status: true, organizerId: true, createdAt: true },
        });
    }

    async requestJoin(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (!trip.isPublic) throw new Error("Trip is private");
        if (trip.organizerId === userId) {
            throw new Error("Організатор вже є учасником своєї подорожі.");
        }

        const req = await this.prisma.joinRequest.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: { status: "PENDING" },
            create: { tripId, userId, status: "PENDING" },
        });

        const who = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });

        const whoText = who?.name?.trim()
            ? `${who.name} (${who.email})`
            : `${who?.email ?? userId}`;

        await this.notifications.create(trip.organizerId, {
            type: NotificationType.JOIN_REQUEST_RECEIVED,
            tripId,
            title: "Нова заявка на участь",
            message: `Користувач ${whoText} подав заявку на участь у подорожі "${trip.title}".`,
        });

        return req;
    }

    async listJoinRequestsForTrip(tripId: string, organizerId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId) throw new ForbiddenException("Forbidden");

        return this.prisma.joinRequest.findMany({
            where: { tripId, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, email: true, name: true } } },
        });
    }

    async approveJoinRequest(tripId: string, requestId: string, organizerId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== organizerId) throw new Error("Forbidden");

        const req = await this.prisma.joinRequest.findUnique({ where: { id: requestId } });
        if (!req || req.tripId !== tripId) throw new Error("Request not found");

        await this.prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: "APPROVED" },
        });

        await this.prisma.tripMember.upsert({
            where: { tripId_userId: { tripId, userId: req.userId } },
            update: { status: "ACTIVE", role: "PARTICIPANT" },
            create: { tripId, userId: req.userId, status: "ACTIVE", role: "PARTICIPANT" },
        });

        const finance = await this.prisma.tripFinance.findUnique({ where: { tripId } });
        if (finance) {
            const amountUah = finance.baseAmountUah + finance.depositUah;

            await this.prisma.payment.upsert({
                where: { tripId_userId: { tripId, userId: req.userId } },
                update: { amountUah, status: "PENDING" },
                create: { tripId, userId: req.userId, amountUah, status: "PENDING" },
            });
        }

        await this.notifications.create(req.userId, {
            type: NotificationType.JOIN_REQUEST_APPROVED,
            tripId,
            title: "Заявку прийнято ✅",
            message: `Організатор прийняв вашу заявку. Ви тепер учасник подорожі "${trip.title}".`,
        });

        return { ok: true };
    }

    async rejectJoinRequest(tripId: string, requestId: string, organizerId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== organizerId) throw new Error("Forbidden");

        const req = await this.prisma.joinRequest.findUnique({ where: { id: requestId } });
        if (!req || req.tripId !== tripId) throw new Error("Request not found");

        await this.prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: "REJECTED" },
        });

        await this.notifications.create(req.userId, {
            type: NotificationType.JOIN_REQUEST_REJECTED,
            tripId,
            title: "Заявку відхилено",
            message: `Організатор відхилив вашу заявку на подорож "${trip.title}".`,
        });

        return { ok: true };
    }

    async deleteTrip(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== userId) throw new Error("Forbidden");

        await this.prisma.$transaction(async (tx) => {
            // 1) Спогади (якщо у вас є ці таблиці в схемі)
            //    (вони були у вас в помилці TripMemory_tripId_fkey)
            await tx.tripMemoryDone.deleteMany({ where: { tripId } });
            await tx.tripMemory.deleteMany({ where: { tripId } });

            // 2) Оплати + фінанси
            await tx.payment.deleteMany({ where: { tripId } });
            await tx.tripFinance.deleteMany({ where: { tripId } });

            // 3) Заявки/учасники
            await tx.joinRequest.deleteMany({ where: { tripId } });
            await tx.tripMember.deleteMany({ where: { tripId } });

            // 4) Маршрутні точки (це ваш актуальний FK-краш)
            await tx.waypoint.deleteMany({ where: { tripId } });

            // 5) Тепер можна видаляти сам Trip
            await tx.trip.delete({ where: { id: tripId } });
        });

        return { ok: true };
    }

    async getPublicTrips() {
        return this.prisma.trip.findMany({
            where: {
                isPublic: true,
                status: {
                    in: [TripStatus.PLANNED, TripStatus.ACTIVE],
                },
            },
            include: {
                organizer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        members: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async createJoinRequest(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
        });

        if (!trip) {
            throw new NotFoundException('Trip not found');
        }

        if (trip.organizerId === userId) {
            throw new BadRequestException('Organizer cannot join own trip');
        }

        const existingMember = await this.prisma.tripMember.findUnique({
            where: {
                tripId_userId: {
                    tripId,
                    userId,
                },
            },
        });

        if (existingMember) {
            throw new BadRequestException('User already a member of this trip');
        }

        const existingRequest = await this.prisma.joinRequest.findFirst({
            where: {
                tripId,
                userId,
                status: 'PENDING',
            },
        });

        if (existingRequest) {
            throw new BadRequestException('Join request already exists');
        }

        return this.prisma.joinRequest.create({
            data: {
                tripId,
                userId,
            },
        });
    }

    async getJoinRequests(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
            select: { organizerId: true },
        });

        if (!trip) {
            throw new NotFoundException('Trip not found');
        }

        if (trip.organizerId !== userId) {
            throw new ForbiddenException('Only organizer can view join requests');
        }

        return this.prisma.joinRequest.findMany({
            where: {
                tripId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async setFinance(
        tripId: string,
        userId: string,
        body: { baseAmountUah: number; depositUah?: number; payDeadline: string }
    ) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== userId) throw new ForbiddenException("Only organizer can set finance");

        const baseAmountUah = Number(body.baseAmountUah);
        const depositUah = Number(body.depositUah ?? 0);

        if (!Number.isFinite(baseAmountUah) || baseAmountUah <= 0)
            throw new BadRequestException("baseAmountUah must be > 0");
        if (!Number.isFinite(depositUah) || depositUah < 0)
            throw new BadRequestException("depositUah must be >= 0");

        const payDeadlineUser = new Date(body.payDeadline);
        if (Number.isNaN(payDeadlineUser.getTime()))
            throw new BadRequestException("payDeadline invalid");

        const now = new Date();
        if (payDeadlineUser <= now) throw new BadRequestException("Deadline cannot be in the past");

        const existingFinance = await this.prisma.tripFinance.findUnique({ where: { tripId } });
        /*if (existingFinance) {
            const msLeft = existingFinance.payDeadlineUser.getTime() - now.getTime();
            if (msLeft < 2 * 60 * 60 * 1000) {
                throw new BadRequestException("Cannot change deadline менее ніж за 2 години до завершення");
            }
        }*/
        if (existingFinance) {
            const msLeft = existingFinance.payDeadlineUser.getTime() - now.getTime();

            const lockMs = process.env.NODE_ENV === "production"
                ? 2 * 60 * 60 * 1000
                : 0;

            if (msLeft < lockMs) {
                throw new BadRequestException("Cannot change deadline менше ніж за 2 години до завершення");
            }
        }

        const payDeadlineOrganizer = new Date(payDeadlineUser.getTime() + 30 * 60 * 1000);

        const finance = await this.prisma.tripFinance.upsert({
            where: { tripId },
            update: { baseAmountUah, depositUah, payDeadlineUser, payDeadlineOrganizer },
            create: { tripId, baseAmountUah, depositUah, payDeadlineUser, payDeadlineOrganizer },
        });

        const members = await this.prisma.tripMember.findMany({
            where: { tripId, status: "ACTIVE" },
            select: { userId: true },
        });

        const amountUah = baseAmountUah + depositUah;

        await this.prisma.$transaction(
            members
                .filter((m) => m.userId !== trip.organizerId)
                .map((m) =>
                    this.prisma.payment.upsert({
                        where: { tripId_userId: { tripId, userId: m.userId } },
                        update: { amountUah, status: "PENDING", reportedAt: null },
                        create: { tripId, userId: m.userId, amountUah, status: "PENDING" },
                    })
                )
        );

        const receivers = members.map((m) => m.userId);
        await this.prisma.notification.createMany({
            data: receivers.map((uid) => ({
                userId: uid,
                tripId,
                type: NotificationType.DEADLINE_CHANGED,
                title: "Оновлено дедлайн оплати",
                message: `Новий дедлайн оплати: ${payDeadlineUser.toISOString().slice(0, 16).replace("T", " ")}`,
            })),
        });

        return { finance };
    }

    async getFinance(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");

        const finance = await this.prisma.tripFinance.findUnique({ where: { tripId } });

        const organizer = await this.prisma.user.findUnique({
            where: { id: trip.organizerId },
            select: { bankLink: true },
        });

        const myPayment = await this.prisma.payment.findUnique({
            where: { tripId_userId: { tripId, userId } },
            select: { userId: true, amountUah: true, status: true },
        });

        let payments: any[] | undefined = undefined;
        if (trip.organizerId === userId) {
            payments = await this.prisma.payment.findMany({
                where: { tripId },
                select: {
                    userId: true,
                    amountUah: true,
                    status: true,
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: "asc" },
            });
        }

        return {
            finance,
            organizerBankLink: organizer?.bankLink ?? null,
            myPayment: myPayment ?? null,
            payments,
        };
    }

    async reportPayment(tripId: string, userId: string, file: Express.Multer.File, note?: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");

        const member = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!member || member.status !== "ACTIVE") throw new ForbiddenException("Not a trip member");

        const finance = await this.prisma.tripFinance.findUnique({ where: { tripId } });
        if (!finance) throw new BadRequestException("Finance not set yet");

        const now = new Date();
        if (now > finance.payDeadlineUser) {
            throw new BadRequestException("Payment is closed (deadline passed)");
        }

        const proofUrl = file ? `/uploads/${file.filename}` : null;

        const payment = await this.prisma.payment.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: {
                status: "REPORTED",
                proofUrl: proofUrl,
                proofName: file?.originalname,
                proofMime: file?.mimetype,
                note: note ?? null,
                rejectReason: null,
            },
            create: {
                tripId,
                userId,
                amountUah: 0,
                status: "REPORTED",
                proofUrl: proofUrl,
                proofName: file?.originalname,
                proofMime: file?.mimetype,
                note: note ?? null,
            },
        });

        if (!payment) throw new BadRequestException("Payment record not found");

        if (payment.status === "CONFIRMED") return payment;

        const u = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });
        const uText = u?.name?.trim() ? `${u.name} (${u.email})` : `${u?.email ?? userId}`;

        await this.notifications.create(trip.organizerId, {
            type: NotificationType.PAYMENT_REPORTED,
            tripId,
            title: "Учасник повідомив про оплату",
            message: `Учасник ${uText} позначив оплату як виконану. Перевірте платіж у подорожі "${trip.title}".`,
        });

        return this.prisma.payment.update({
            where: { tripId_userId: { tripId, userId } },
            data: { status: "REPORTED", reportedAt: new Date() },
            select: { userId: true, amountUah: true, status: true, reportedAt: true },
        });
    }

    async confirmPayment(tripId: string, organizerId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId) throw new ForbiddenException("Only organizer");

        await this.notifications.create(userId, {
            type: NotificationType.PAYMENT_CONFIRMED,
            tripId,
            title: "Оплату підтверджено ✅",
            message: `Організатор підтвердив вашу оплату у подорожі "${trip.title}".`,
        });

        return this.prisma.payment.update({
            where: { tripId_userId: { tripId, userId } },
            data: { status: "CONFIRMED" },
            select: { userId: true, amountUah: true, status: true },
        });
    }

    async rejectPayment(tripId: string, organizerId: string, userId: string, reason?: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId) throw new ForbiddenException("Only organizer");

        await this.notifications.create(userId, {
            type: NotificationType.PAYMENT_REJECTED,
            tripId,
            title: "Оплату відхилено",
            message: `Організатор відхилив вашу оплату у подорожі "${trip.title}". Завантажте коректний чек/скрін і спробуйте ще раз.`,
        });

        return this.prisma.payment.update({
            where: { tripId_userId: { tripId, userId } },
            data: { status: "REJECTED" },
            select: { userId: true, amountUah: true, status: true },
        });
    }

    async enforceDeadline(tripId: string, organizerId: string) {
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
        });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId)
            throw new ForbiddenException("Only organizer can do this");

        const finance = await this.prisma.tripFinance.findUnique({
            where: { tripId },
        });
        if (!finance) throw new BadRequestException("Finance not set");

        const now = new Date();
        if (now < finance.payDeadlineUser) {
            return {
                ok: true,
                removed: 0,
                message: "Deadline not reached yet",
            };
        }

        const unpaidMembers = await this.prisma.tripMember.findMany({
            where: {
                tripId,
                user: {
                    payments: {
                        some: {
                            tripId,
                            status: {
                                in: [
                                    PaymentStatus.PENDING,
                                    PaymentStatus.REPORTED,
                                    PaymentStatus.REJECTED,
                                ],
                            },
                            removedAt: null,
                        },
                    },
                },
            },
            select: { userId: true },
        });

        if (unpaidMembers.length === 0) {
            return { ok: true, removed: 0 };
        }

        const userIds = unpaidMembers.map((m) => m.userId);

        await this.prisma.$transaction([
            this.prisma.tripMember.deleteMany({
                where: {
                    tripId,
                    userId: { in: userIds },
                },
            }),

            this.prisma.payment.updateMany({
                where: {
                    tripId,
                    userId: { in: userIds },
                    status: {
                        in: [
                            PaymentStatus.PENDING,
                            PaymentStatus.REPORTED,
                            PaymentStatus.REJECTED,
                        ],
                    },
                    removedAt: null,
                },
                data: { removedAt: new Date() },
            }),
        ]);

        if (userIds.length > 0) {
            await this.prisma.notification.createMany({
                data: userIds.map((uid) => ({
                    userId: uid,
                    tripId, // Можна додати, щоб клікнувши на сповіщення, відкривалась поїздка
                    type: NotificationType.MEMBER_EXCLUDED,
                    title: "Виключено з подорожі",
                    message: "Вас було виключено з подорожі через несплату до дедлайну.",
                })),
            });
        }

        return {
            ok: true,
            removed: userIds.length,
        };
    }

    async listMembers(tripId: string, userId: string) {
        const m = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!m || m.status !== "ACTIVE") throw new ForbiddenException("Forbidden");

        const members = await this.prisma.tripMember.findMany({
            where: { tripId, status: "ACTIVE" },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" as any },
        });

        const payments = await this.prisma.payment.findMany({
            where: { tripId },
            select: { userId: true, status: true, amountUah: true },
        });

        const payMap = new Map(payments.map((p) => [p.userId, p]));

        return members.map((x) => ({
            user: x.user,
            role: x.role,
            status: x.status,
            payment: payMap.get(x.userId) ?? null,
        }));
    }

    async listPendingPayments(tripId: string, organizerId: string) {
        if (!organizerId) return [];

        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");

        if (trip.organizerId !== organizerId) return [];

        return this.prisma.payment.findMany({
            where: { tripId, status: "REPORTED" },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                userId: true,
                amountUah: true,
                status: true,
                note: true,
                proofUrl: true,
                proofName: true,
                proofMime: true,
                updatedAt: true,
                rejectReason: true,
                user: { select: { email: true, name: true } },
            },
        });
    }
}
