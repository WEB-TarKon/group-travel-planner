import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
    ) {}

    async register(email: string, password: string, name?: string) {
        const exists = await this.prisma.user.findUnique({ where: { email } });
        if (exists) throw new ConflictException("Email already in use");

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.prisma.user.create({
            data: { email, name, passwordHash },
            select: { id: true, email: true, name: true },
        });

        return this.sign(user.id);
    }

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException("Invalid credentials");

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) throw new UnauthorizedException("Invalid credentials");

        return this.sign(user.id);
    }

    private sign(userId: string) {
        const accessToken = this.jwt.sign({ sub: userId });
        return { accessToken };
    }
}
