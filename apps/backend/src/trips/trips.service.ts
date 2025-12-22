import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

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

        return this.prisma.joinRequest.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: { status: "PENDING" },
            create: { tripId, userId, status: "PENDING" },
        });
    }

    async listJoinRequestsForTrip(tripId: string, organizerId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== organizerId) throw new Error("Forbidden");

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
}
