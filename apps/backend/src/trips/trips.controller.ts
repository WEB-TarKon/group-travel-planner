import {Body, Controller, Delete, Get, Param, Post, Req, UseGuards} from "@nestjs/common";
import { TripsService } from "./trips.service";
import { SaveWaypointsDto } from "./dto/save-waypoints.dto";
import { JwtGuard } from "../auth/jwt.guard";
import { AuthGuard } from '@nestjs/passport';

@UseGuards(JwtGuard)
@Controller("trips")
export class TripsController {
    constructor(private trips: TripsService) {}

    @Get()
    list(@Req() req: any) {
        return this.trips.listMyTrips(req.user.id);
    }

    @Get("/public/list")
    publicList() {
        return this.trips.listPublicTrips();
    }

    @Get(":id")
    get(@Param("id") id: string) {
        return this.trips.getTrip(id);
    }

    @Get('public-trips')
    getPublicTrips() {
        return this.trips.getPublicTrips();
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('trips/:id/join-requests')
    getJoinRequests(
        @Param('id') tripId: string,
        @Req() req,
    ) {
        return this.trips.getJoinRequests(tripId, req.user.id);
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

    @Post(":id/join-requests")
    requestJoin(@Req() req: any, @Param("id") id: string) {
        return this.trips.requestJoin(id, req.user.id);
    }

    @Get(":id/join-requests")
    listRequests(@Req() req: any, @Param("id") id: string) {
        return this.trips.listJoinRequestsForTrip(id, req.user.id);
    }

    @Post(":id/join-requests/:requestId/approve")
    approve(@Req() req: any, @Param("id") id: string, @Param("requestId") requestId: string) {
        return this.trips.approveJoinRequest(id, requestId, req.user.id);
    }

    @Post(":id/join-requests/:requestId/reject")
    reject(@Req() req: any, @Param("id") id: string, @Param("requestId") requestId: string) {
        return this.trips.rejectJoinRequest(id, requestId, req.user.id);
    }

    @Delete(":id")
    remove(@Req() req: any, @Param("id") id: string) {
        return this.trips.deleteTrip(id, req.user.id);
    }

    @Post(":id/finance")
    setFinance(
        @Req() req: any,
        @Param("id") id: string,
        @Body() body: { baseAmountUah: number; depositUah?: number; payDeadline: string }
    ) {
        return this.trips.setFinance(id, req.user.id, body);
    }

    @Get(":id/finance")
    getFinance(@Req() req: any, @Param("id") id: string) {
        return this.trips.getFinance(id, req.user.id);
    }
}
