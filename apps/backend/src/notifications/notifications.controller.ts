import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "../auth/jwt.guard";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtGuard)
@Controller("notifications")
export class NotificationsController {
    constructor(private n: NotificationsService) {}

    @Get()
    list(@Req() req: any) {
        return this.n.list(req.user.id);
    }

    @Post(":id/read")
    read(@Req() req: any, @Param("id") id: string) {
        return this.n.markRead(req.user.id, id);
    }

    @Post("test")
    test(@Req() req: any) {
        return this.n.create(req.user.id, "Тест", "Це тестове сповіщення");
    }
}
