import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from "@nestjs/common";
import { JwtGuard } from "../auth/jwt.guard";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";

@UseGuards(JwtGuard)
@Controller("trips/:tripId/chat")
export class ChatController {
    constructor(private s: ChatService) {}

    @Get()
    list(@Req() req: any, @Param("tripId") tripId: string, @Query("cursor") cursor?: string) {
        return this.s.list(tripId, req.user.id, cursor);
    }

    @Get("unread-count")
    unread(@Req() req: any, @Param("tripId") tripId: string) {
        return this.s.unreadCount(tripId, req.user.id);
    }

    @Get("search")
    search(@Req() req: any, @Param("tripId") tripId: string, @Query("q") q: string) {
        return this.s.search(tripId, req.user.id, q ?? "");
    }

    @Post("message")
    send(@Req() req: any, @Param("tripId") tripId: string, @Body() dto: SendMessageDto) {
        return this.s.send(tripId, req.user.id, dto);
    }

    @Post("read")
    markRead(@Req() req: any, @Param("tripId") tripId: string, @Body() dto: MarkReadDto) {
        return this.s.markRead(tripId, req.user.id, dto.lastReadMessageId);
    }

    // upload як у memories (тільки окремим endpoint)
    @Post("upload")
    @UseInterceptors(
        FileInterceptor("file", {
            storage: diskStorage({
                destination: "./uploads",
                filename: (req, file, cb) => {
                    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                    cb(null, `${unique}${extname(file.originalname)}`);
                },
            }),
            limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
        }),
    )
    upload(@UploadedFile() file: Express.Multer.File) {
        const fileUrl = file ? `/uploads/${file.filename}` : null;
        return {
            fileUrl,
            fileName: file?.originalname ?? null,
            fileMime: file?.mimetype ?? null,
        };
    }
}
