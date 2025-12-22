import {Body, Controller, Get, Param, Post, Req, UseGuards} from "@nestjs/common";
import { TripsService } from "./trips.service";
import { SaveWaypointsDto } from "./dto/save-waypoints.dto";
import { JwtGuard } from "../auth/jwt.guard";

@UseGuards(JwtGuard)
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
    create(@Req() req: any, @Body() body: { title: string; isPublic?: boolean }) {
        return this.trips.createTrip({
            title: body.title,
            isPublic: body.isPublic,
            organizerId: req.user.id,
        });
    }

    @Post(":id/waypoints")
    async saveWaypoints(@Param("id") id: string, @Body() body: SaveWaypointsDto) {
        await this.trips.upsertWaypoints(id, body.waypoints);
        return this.trips.getTrip(id);
    }
}
