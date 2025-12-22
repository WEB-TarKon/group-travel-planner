import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) {}

    getMe(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true, bankLink: true },
        });
    }

    updateMe(userId: string, data: { name?: string; bankLink?: string }) {
        return this.prisma.user.update({
            where: { id: userId },
            data: { name: data.name, bankLink: data.bankLink },
            select: { id: true, email: true, name: true, bankLink: true },
        });
    }
}
