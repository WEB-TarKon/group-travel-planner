import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MemoryType, TripStatus } from "@prisma/client";

@Injectable()
export class MemoriesService {
    constructor(private prisma: PrismaService) {}

    async ensureMember(tripId: string, userId: string) {
        const m = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!m) throw new Error("Forbidden");
    }

    async ensureOrganizer(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== userId) throw new Error("Forbidden");
        return trip;
    }

    async setTripFinished(tripId: string, organizerId: string) {
        const trip = await this.ensureOrganizer(tripId, organizerId);

        return this.prisma.trip.update({
            where: { id: tripId },
            data: { status: TripStatus.FINISHED },
        });
    }

    async list(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        return this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                type: true,
                text: true,
                fileUrl: true,
                fileName: true,
                fileMime: true,
                createdAt: true,
                user: { select: { id: true, email: true, name: true } },
            },
        });
    }

    async create(
        tripId: string,
        userId: string,
        data: {
            type: MemoryType;
            text?: string | null;
            fileUrl?: string | null;
            fileName?: string | null;
            fileMime?: string | null;
        }
    ) {
        await this.ensureMember(tripId, userId);

        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.status !== TripStatus.FINISHED) throw new Error("Trip is not finished");

        return this.prisma.tripMemory.create({
            data: {
                tripId,
                userId,
                type: data.type,
                text: data.text ?? null,
                fileUrl: data.fileUrl ?? null,
                fileName: data.fileName ?? null,
                fileMime: data.fileMime ?? null,
            },
        });
    }

    async remove(tripId: string, userId: string, memoryId: string) {
        await this.ensureMember(tripId, userId);

        const mem = await this.prisma.tripMemory.findUnique({ where: { id: memoryId } });
        if (!mem || mem.tripId !== tripId) throw new Error("Not found");

        // можна видаляти лише своє
        if (mem.userId !== userId) throw new Error("Forbidden");

        return this.prisma.tripMemory.delete({ where: { id: memoryId } });
    }

    async markDone(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.status !== TripStatus.FINISHED) throw new Error("Trip is not finished");

        return this.prisma.tripMemoryDone.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: { doneAt: new Date() },
            create: { tripId, userId },
        });
    }

    async doneStatus(tripId: string, organizerId: string) {
        await this.ensureOrganizer(tripId, organizerId);

        const members = await this.prisma.tripMember.findMany({
            where: { tripId },
            select: { userId: true, role: true, user: { select: { email: true, name: true } } },
        });

        const done = await this.prisma.tripMemoryDone.findMany({
            where: { tripId },
            select: { userId: true, doneAt: true },
        });

        const doneMap = new Map(done.map((d) => [d.userId, d.doneAt]));

        return members.map((m) => ({
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            doneAt: doneMap.get(m.userId) ?? null,
        }));
    }

    async exportJson(tripId: string, organizerId: string) {
        const trip = await this.ensureOrganizer(tripId, organizerId);

        const memories = await this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "asc" },
            select: {
                type: true,
                text: true,
                fileUrl: true,
                fileName: true,
                fileMime: true,
                createdAt: true,
                user: { select: { email: true, name: true } },
            },
        });

        return { trip: { id: trip.id, title: trip.title, status: trip.status }, memories };
    }
}
