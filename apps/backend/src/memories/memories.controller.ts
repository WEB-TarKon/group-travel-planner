import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Req,
    UseGuards,
    UseInterceptors,
    UploadedFile,
} from "@nestjs/common";
import { JwtGuard } from "../auth/jwt.guard";
import { MemoriesService } from "./memories.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { MemoryType } from "@prisma/client";

@UseGuards(JwtGuard)
@Controller("trips/:tripId/memories")
export class MemoriesController {
    constructor(private s: MemoriesService) {}

    @Post("/finish")
    finishTrip(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.setTripFinished(tripId, req.user.id);
    }

    @Get()
    list(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.list(tripId, req.user.id);
    }

    @Get("/my-done")
    myDone(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.myDone(tripId, req.user.id);
    }

    @Post()
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "./uploads",
                filename: (req, file, cb) => {
                    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                    cb(null, `${unique}${extname(file.originalname)}`);
                },
            }),
            limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
        })
    )
    create(
        @Req() req: any,
        @Param("tripId") tripId: string,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { type: MemoryType; text?: string }
    ) {
        const fileUrl = file ? `/uploads/${file.filename}` : null;

        return this.s.create(tripId, req.user.id, {
            type: body.type,
            text: body.text ?? null,
            fileUrl,
            fileName: file?.originalname,
            fileMime: file?.mimetype,
        });
    }

    @Delete(":memoryId")
    remove(@Req() req: any, @Param("tripId") tripId: string, @Param("memoryId") memoryId: string) {
        return this.s.remove(tripId, req.user.id, memoryId);
    }

    @Post("/done")
    done(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.markDone(tripId, req.user.id);
    }

    @Get("/done-status")
    doneStatus(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.doneStatus(tripId, req.user.id);
    }

    @Get("/export")
    exportJson(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.exportJson(tripId, req.user.id);
    }
}
