import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { TripsService } from "./trips.service";

@Controller("trips")
export class TripsController {
    constructor(private trips: TripsService) {}

    @Get()
    list() {
        return this.trips.listTrips();
    }

    @Get(":id")
    get(@Param("id") id: string) {
        return this.trips.getTrip(id);
    }

    @Post()
    create(@Body() body: { title: string; isPublic?: boolean; organizerId: string }) {
        return this.trips.createTrip(body);
    }

    @Post(":id/waypoints")
    saveWaypoints(
        @Param("id") id: string,
        @Body() body: { waypoints: Array<{ order: number; lat: number; lng: number; title?: string }> },
    ) {
        return this.trips.upsertWaypoints(id, body.waypoints);
    }
}
