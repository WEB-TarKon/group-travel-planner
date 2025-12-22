import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtGuard implements CanActivate {
    constructor(private jwt: JwtService) {}

    canActivate(ctx: ExecutionContext) {
        const req = ctx.switchToHttp().getRequest();
        const header = req.headers["authorization"] as string | undefined;
        const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
        if (!token) throw new UnauthorizedException("Missing token");

        try {
            const payload = this.jwt.verify(token);
            req.user = { id: payload.sub as string };
            return true;
        } catch {
            throw new UnauthorizedException("Invalid token");
        }
    }
}
