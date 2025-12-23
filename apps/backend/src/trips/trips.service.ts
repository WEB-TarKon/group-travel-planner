import { PrismaService } from "../prisma.service";
import {TripStatus} from "@prisma/client";
import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from "@nestjs/common";

@Injectable()
export class TripsService {
    constructor(private prisma: PrismaService) {}

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

    upsertWaypoints(tripId: string, waypoints: Array<{ order: number; lat: number; lng: number; title?: string }>) {
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

        return this.prisma.joinRequest.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: { status: "PENDING" },
            create: { tripId, userId, status: "PENDING" },
        });
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

        return { ok: true };
    }

    async deleteTrip(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== userId) throw new Error("Forbidden");

        await this.prisma.$transaction([
            this.prisma.payment.deleteMany({ where: { tripId } }),
            this.prisma.tripFinance.deleteMany({ where: { tripId } }),

            this.prisma.joinRequest.deleteMany({ where: { tripId } }),
            this.prisma.tripMember.deleteMany({ where: { tripId } }),
            this.prisma.waypoint.deleteMany({ where: { tripId } }),

            this.prisma.trip.delete({ where: { id: tripId } }),
        ]);

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

        if (!Number.isFinite(baseAmountUah) || baseAmountUah <= 0) {
            throw new BadRequestException("baseAmountUah must be > 0");
        }
        if (!Number.isFinite(depositUah) || depositUah < 0) {
            throw new BadRequestException("depositUah must be >= 0");
        }

        const payDeadline = new Date(body.payDeadline);
        if (Number.isNaN(payDeadline.getTime())) {
            throw new BadRequestException("payDeadline invalid");
        }

        const finance = await this.prisma.tripFinance.upsert({
            where: { tripId },
            update: { baseAmountUah, depositUah, payDeadline },
            create: { tripId, baseAmountUah, depositUah, payDeadline },
        });

        const members = await this.prisma.tripMember.findMany({
            where: { tripId, status: "ACTIVE" },
            select: { userId: true, role: true },
        });

        const amountUah = baseAmountUah + depositUah;

        await this.prisma.$transaction(
            members
                .filter((m) => m.userId !== trip.organizerId) // організатору payment не створюємо
                .map((m) =>
                    this.prisma.payment.upsert({
                        where: { tripId_userId: { tripId, userId: m.userId } },
                        update: { amountUah, status: "PENDING" },
                        create: { tripId, userId: m.userId, amountUah, status: "PENDING" },
                    })
                )
        );

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
    async reportPayment(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");

        const member = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!member || member.status !== "ACTIVE") throw new ForbiddenException("Not a trip member");

        const payment = await this.prisma.payment.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!payment) throw new BadRequestException("Finance not set yet");

        if (payment.status === "CONFIRMED") return payment;

        return this.prisma.payment.update({
            where: { tripId_userId: { tripId, userId } },
            data: { status: "REPORTED" },
            select: { userId: true, amountUah: true, status: true },
        });
    }

    async confirmPayment(tripId: string, organizerId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId) throw new ForbiddenException("Only organizer");

        return this.prisma.payment.update({
            where: { tripId_userId: { tripId, userId } },
            data: { status: "CONFIRMED" },
            select: { userId: true, amountUah: true, status: true },
        });
    }

    async rejectPayment(tripId: string, organizerId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new NotFoundException("Trip not found");
        if (trip.organizerId !== organizerId) throw new ForbiddenException("Only organizer");

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
        if (now < finance.payDeadline) {
            return {
                ok: true,
                removed: 0,
                message: "Deadline not reached yet",
            };
        }

        const unpaidPayments = await this.prisma.payment.findMany({
            where: {
                tripId,
                status: {
                    in: ["PENDING", "REPORTED", "REJECTED"],
                },
                removedAt: null,
            },
            select: { userId: true },
        });

        if (unpaidPayments.length === 0) {
            return { ok: true, removed: 0 };
        }

        const userIds = unpaidPayments.map((p) => p.userId);

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
                },
                data: { removedAt: new Date() },
            }),
        ]);

        return {
            ok: true,
            removed: userIds.length,
        };
    }
}
