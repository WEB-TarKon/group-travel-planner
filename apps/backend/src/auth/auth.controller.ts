import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtGuard } from "./jwt.guard";
import {
    GoogleAuthDto,
    LoginDto,
    PasswordResetConfirmDto,
    PasswordResetRequestDto,
    RegisterDto,
} from "./dto";

@Controller("auth")
export class AuthController {
    constructor(private auth: AuthService) {}

    @Post("register")
    register(@Body() body: RegisterDto) {
        return this.auth.register(body);
    }

    @Post("login")
    login(@Body() body: LoginDto) {
        return this.auth.login(body);
    }

    @Post("google")
    google(@Body() body: GoogleAuthDto) {
        return this.auth.googleAuth(body.credential);
    }

    @Post("password-reset/request")
    passwordResetRequest(@Body() body: PasswordResetRequestDto) {
        return this.auth.requestPasswordReset(body);
    }

    @Post("password-reset/confirm")
    passwordResetConfirm(@Body() body: PasswordResetConfirmDto) {
        return this.auth.confirmPasswordReset(body);
    }

    @UseGuards(JwtGuard)
    @Get("me")
    me(@Req() req: any) {
        return { id: req.user.id };
    }
}
