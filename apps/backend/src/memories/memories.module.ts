import { Module } from "@nestjs/common";
import { MemoriesController } from "./memories.controller";
import { MemoriesService } from "./memories.service";
import { PrismaService } from "../prisma.service";
import {AuthModule} from "../auth/auth.module";

@Module({
    imports: [AuthModule],
    controllers: [MemoriesController],
    providers: [MemoriesService, PrismaService],
})
export class MemoriesModule {}
