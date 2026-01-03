import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ChatService } from "./chat.service";

@WebSocketGateway({
    cors: { origin: true, credentials: true },
    namespace: "/chat",
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;

    constructor(private jwt: JwtService, private chat: ChatService) {}

    async handleConnection(client: Socket) {
        try {
            const token =
                (client.handshake.auth?.token as string) ||
                (client.handshake.headers?.authorization as string)?.replace("Bearer ", "");

            if (!token) {
                client.disconnect();
                return;
            }

            const payload: any = this.jwt.verify(token);
            client.data.userId = payload?.sub || payload?.id || payload?.userId;

            if (!client.data.userId) {
                client.disconnect();
            }
        } catch {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {}

    @SubscribeMessage("joinTrip")
    async joinTrip(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string }) {
        const userId = client.data.userId as string;
        const tripId = body.tripId;

        await this.chat.ensureMember(tripId, userId);

        client.join(`trip:${tripId}`);

        const last = await this.chat.list(tripId, userId);
        client.emit("history", last);

        return { ok: true };
    }

    @SubscribeMessage("typing")
    async typing(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string; isTyping: boolean }) {
        const userId = client.data.userId as string;
        await this.chat.ensureMember(body.tripId, userId);

        client.to(`trip:${body.tripId}`).emit("typing", { userId, isTyping: body.isTyping });
    }

    @SubscribeMessage("sendMessage")
    async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string; dto: any }) {
        const userId = client.data.userId as string;
        const msg = await this.chat.send(body.tripId, userId, body.dto);

        this.server.to(`trip:${body.tripId}`).emit("newMessage", msg);

        return msg;
    }

    @SubscribeMessage("markRead")
    async markRead(@ConnectedSocket() client: Socket, @MessageBody() body: { tripId: string; lastReadMessageId?: string }) {
        const userId = client.data.userId as string;
        await this.chat.markRead(body.tripId, userId, body.lastReadMessageId);

        client.to(`trip:${body.tripId}`).emit("read", { userId, lastReadMessageId: body.lastReadMessageId ?? null });
        return { ok: true };
    }
}
