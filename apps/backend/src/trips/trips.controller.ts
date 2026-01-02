import {Body, Controller, Delete, Get, Param, Post, Req, UseGuards} from "@nestjs/common";
import { TripsService } from "./trips.service";
import { SaveWaypointsDto } from "./dto/save-waypoints.dto";
import { JwtGuard } from "../auth/jwt.guard";
import { AuthGuard } from '@nestjs/passport';
import { UseInterceptors, UploadedFile } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { ReportPaymentDto } from "./dto/report-payment.dto";

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

    @Get(":id/members")
    members(@Req() req: any, @Param("id") id: string) {
        return this.trips.listMembers(id, req.user.id);
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

    @Post(":id/payments/report")
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "./uploads",
                filename: (req, file, cb) => {
                    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                    cb(null, `${unique}${extname(file.originalname)}`);
                },
            }),
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        })
    )
    reportPayment(
        @Req() req: any,
        @Param("id") id: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: ReportPaymentDto
    ) {
        return this.trips.reportPayment(id, req.user.id, file, body?.note);
    }

    @Post(":id/payments/:userId/confirm")
    confirm(@Req() req: any, @Param("id") id: string, @Param("userId") userId: string) {
        return this.trips.confirmPayment(id, req.user.id, userId);
    }

    @Post(":id/payments/:userId/reject")
    rejectPayment(
        @Req() req: any,
        @Param("id") id: string,
        @Param("userId") userId: string,
        @Body() body: { reason?: string }
    ) {
        return this.trips.rejectPayment(id, req.user.id, userId, body?.reason);
    }

    @Post(":id/finance/enforce-deadline")
    enforceDeadline(@Req() req: any, @Param("id") id: string) {
        return this.trips.enforceDeadline(id, req.user.id);
    }

    @Get(":id/payments/pending")
    pendingPayments(@Req() req: any, @Param("id") id: string) {
        return this.trips.listPendingPayments(id, req.user.id);
    }

    // FOOD
    @Get(":id/food/items")
    foodItems(@Req() req: any, @Param("id") id: string) {
        return this.trips.listFoodItems(id, req.user.id);
    }

    @Post(":id/food/items")
    addFoodItem(@Req() req: any, @Param("id") id: string, @Body() body: { title: string; priceUah: number }) {
        return this.trips.addFoodItem(id, req.user.id, body);
    }

    @Delete(":id/food/items/:itemId")
    deleteFoodItem(@Req() req: any, @Param("id") id: string, @Param("itemId") itemId: string) {
        return this.trips.deleteFoodItem(id, req.user.id, itemId);
    }

    @Get(":id/food/selection")
    myFoodSelection(@Req() req: any, @Param("id") id: string) {
        return this.trips.getMyFoodSelection(id, req.user.id);
    }

    @Post(":id/food/selection")
    setMyFoodSelection(@Req() req: any, @Param("id") id: string, @Body() body: { itemIds: string[] }) {
        return this.trips.setMyFoodSelection(id, req.user.id, body);
    }

    @Get(":id/food/summary")
    foodSummary(@Req() req: any, @Param("id") id: string) {
        return this.trips.foodSummary(id, req.user.id);
    }
}
