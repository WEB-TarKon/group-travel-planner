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
            include: { waypoints: { orderBy: { order: "asc" } } },
        });
    }

    createTrip(data: { title: string; isPublic?: boolean; organizerId: string }) {
        return this.prisma.trip.create({
            data: {
                title: data.title,
                isPublic: data.isPublic ?? false,
                organizerId: data.organizerId,
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
}
