import { Body, Controller, Get, Put, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "../auth/jwt.guard";
import { UsersService } from "./users.service";

@UseGuards(JwtGuard)
@Controller("users")
export class UsersController {
    constructor(private users: UsersService) {}

    @Get("me")
    me(@Req() req: any) {
        return this.users.getMe(req.user.id);
    }

    @Put("me")
    updateMe(@Req() req: any, @Body() body: { name?: string; bankLink?: string }) {
        return this.users.updateMe(req.user.id, body);
    }
}
