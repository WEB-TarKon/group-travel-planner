import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Get, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "./jwt.guard";

@Controller("auth")
export class AuthController {
    constructor(private auth: AuthService) {}

    @Post("register")
    register(@Body() body: { email: string; password: string; name?: string }) {
        return this.auth.register(body.email, body.password, body.name);
    }

    @Post("login")
    login(@Body() body: { email: string; password: string }) {
        return this.auth.login(body.email, body.password);
    }

    @UseGuards(JwtGuard)
    @Get("me")
    me(@Req() req: any) {
        return { id: req.user.id };
    }
}
