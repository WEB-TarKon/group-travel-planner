import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MemoryType, TripStatus } from "@prisma/client";
import archiver from "archiver";
import * as path from "path";
import * as fs from "fs";
import { Response } from "express";

@Injectable()
export class MemoriesService {
    constructor(private prisma: PrismaService) {}

    async ensureMember(tripId: string, userId: string) {
        const m = await this.prisma.tripMember.findUnique({
            where: { tripId_userId: { tripId, userId } },
        });
        if (!m) throw new Error("Forbidden");
    }

    async ensureOrganizer(tripId: string, userId: string) {
        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.organizerId !== userId) throw new Error("Forbidden");
        return trip;
    }

    async setTripFinished(tripId: string, organizerId: string) {
        const trip = await this.ensureOrganizer(tripId, organizerId);

        return this.prisma.trip.update({
            where: { id: tripId },
            data: { status: TripStatus.FINISHED },
        });
    }

    async list(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        return this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                type: true,
                text: true,
                fileUrl: true,
                fileName: true,
                fileMime: true,
                createdAt: true,
                user: { select: { id: true, email: true, name: true } },
            },
        });
    }

    async create(
        tripId: string,
        userId: string,
        data: {
            type: MemoryType;
            text?: string | null;
            fileUrl?: string | null;
            fileName?: string | null;
            fileMime?: string | null;
        }
    ) {
        await this.ensureMember(tripId, userId);

        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.status !== TripStatus.FINISHED) throw new Error("Trip is not finished");

        return this.prisma.tripMemory.create({
            data: {
                tripId,
                userId,
                type: data.type,
                text: data.text ?? null,
                fileUrl: data.fileUrl ?? null,
                fileName: data.fileName ?? null,
                fileMime: data.fileMime ?? null,
            },
        });
    }

    async remove(tripId: string, userId: string, memoryId: string) {
        await this.ensureMember(tripId, userId);

        const mem = await this.prisma.tripMemory.findUnique({ where: { id: memoryId } });
        if (!mem || mem.tripId !== tripId) throw new Error("Not found");

        // можна видаляти лише своє
        if (mem.userId !== userId) throw new Error("Forbidden");

        return this.prisma.tripMemory.delete({ where: { id: memoryId } });
    }

    async markDone(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) throw new Error("Trip not found");
        if (trip.status !== TripStatus.FINISHED) throw new Error("Trip is not finished");

        return this.prisma.tripMemoryDone.upsert({
            where: { tripId_userId: { tripId, userId } },
            update: { doneAt: new Date() },
            create: { tripId, userId },
        });
    }

    async doneStatus(tripId: string, organizerId: string) {
        await this.ensureOrganizer(tripId, organizerId);

        const members = await this.prisma.tripMember.findMany({
            where: { tripId },
            select: { userId: true, role: true, user: { select: { email: true, name: true } } },
        });

        const done = await this.prisma.tripMemoryDone.findMany({
            where: { tripId },
            select: { userId: true, doneAt: true },
        });

        const doneMap = new Map(done.map((d) => [d.userId, d.doneAt]));

        return members.map((m) => ({
            userId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            doneAt: doneMap.get(m.userId) ?? null,
        }));
    }

    async exportJson(tripId: string, organizerId: string) {
        const trip = await this.ensureOrganizer(tripId, organizerId);

        const memories = await this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "asc" },
            select: {
                type: true,
                text: true,
                fileUrl: true,
                fileName: true,
                fileMime: true,
                createdAt: true,
                user: { select: { email: true, name: true } },
            },
        });

        return { trip: { id: trip.id, title: trip.title, status: trip.status }, memories };
    }

    async myDone(tripId: string, userId: string) {
        await this.ensureMember(tripId, userId);

        const row = await this.prisma.tripMemoryDone.findUnique({
            where: { tripId_userId: { tripId, userId } },
            select: { doneAt: true },
        });

        return { doneAt: row?.doneAt ?? null };
    }

    async exportAlbumZip(tripId: string, userId: string, res: Response) {
        // 1) Перевірка доступу: учасник або організатор
        // Підлаштуй під ваші таблиці членства.
        // Ідея: якщо не учасник/організатор => Forbidden.
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
            select: { id: true, title: true, organizerId: true, status: true },
        });
        if (!trip) throw new Error("Trip not found");

        // ⚠️ ВАЖЛИВО: тут зроби перевірку "user є учасником"
        // Нижче універсальний варіант: або організатор, або є запис у TripMember (назву підставте вашу).
        const isOrganizer = trip.organizerId === userId;

        const member = await this.prisma.tripMember.findFirst({
            where: { tripId, userId },
            select: { id: true },
        });

        if (!isOrganizer && !member) {
            // як у вас прийнято: throw new ForbiddenException()
            throw new Error("Forbidden");
        }

        // (опційно) дозволяти експорт тільки коли FINISHED
        // if (trip.status !== "FINISHED") throw new Error("Forbidden");

        // 2) Забираємо спогади
        const memories = await this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        // 3) Готуємо zip stream
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("error", (err) => {
            try {
                res.status(500).send(String(err));
            } catch {}
        });

        archive.pipe(res);

        // 4) manifest.json
        const manifest = {
            trip: {
                id: trip.id,
                title: trip.title,
                status: trip.status,
            },
            exportedAt: new Date().toISOString(),
            items: memories.map((m: any) => ({
                id: m.id,
                type: m.type,
                text: m.text ?? null,
                createdAt: m.createdAt,
                author: {
                    id: m.user?.id,
                    name: m.user?.name ?? null,
                    email: m.user?.email ?? null,
                },
                fileName: m.fileName ?? null,
                fileUrl: m.fileUrl ?? null,
            })),
        };

        archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

        // 5) index.html (проста локальна html-сторінка)
        const html = this.buildAlbumHtml(manifest);
        archive.append(html, { name: "index.html" });

        // 6) Додаємо файли спогадів (якщо є)
        // Очікуємо що fileUrl типу "/uploads/...."
        const uploadsRoot = path.join(process.cwd(), "uploads");

        for (const m of memories as any[]) {
            if (!m.fileUrl) continue;

            // Захист від path traversal
            const clean = String(m.fileUrl).replace(/^https?:\/\/[^/]+/i, ""); // якщо раптом з повним хостом
            const rel = clean.startsWith("/") ? clean.slice(1) : clean;

            // якщо у вас зберігається "uploads/xxx" або "/uploads/xxx"
            const relFromUploads = rel.startsWith("uploads/")
                ? rel.slice("uploads/".length)
                : rel.startsWith("uploads\\")
                    ? rel.slice("uploads\\".length)
                    : rel.startsWith("uploads") && (rel[7] === "/" || rel[7] === "\\")
                        ? rel.slice(8)
                        : rel.startsWith("uploads") ? rel.replace(/^uploads[\\/]/, "") : rel.replace(/^uploads[\\/]/, "");

            const fileAbs = path.join(uploadsRoot, relFromUploads);
            const normalized = path.normalize(fileAbs);

            if (!normalized.startsWith(path.normalize(uploadsRoot))) continue;
            if (!fs.existsSync(normalized)) continue;

            const safeName = m.fileName
                ? `${m.createdAt.toISOString().slice(0, 10)}_${m.id}_${m.fileName}`
                : `${m.createdAt.toISOString().slice(0, 10)}_${m.id}_${path.basename(normalized)}`;

            archive.file(normalized, { name: path.join("files", safeName) });
        }

        await archive.finalize();
    }

    private buildAlbumHtml(manifest: any) {
        const esc = (s: any) =>
            String(s ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

        const rows = (manifest.items || [])
            .map((it: any) => {
                const author = esc(it.author?.name || it.author?.email || "Учасник");
                const date = esc(it.createdAt);
                const text = it.text ? `<div style="margin:6px 0">${esc(it.text)}</div>` : "";

                let media = "";
                if (it.fileName) {
                    const filePath = `files/${esc(
                        `${it.createdAt.slice(0, 10)}_${it.id}_${it.fileName}`
                    )}`;
                    if (it.type === "PHOTO") media = `<img src="${filePath}" style="max-width:100%;border-radius:8px;" />`;
                    else if (it.type === "VIDEO") media = `<video src="${filePath}" controls style="max-width:100%;border-radius:8px;"></video>`;
                    else if (it.type === "AUDIO") media = `<audio src="${filePath}" controls></audio>`;
                    else media = `<a href="${filePath}">Відкрити файл</a>`;
                }

                return `
                    <div style="border:1px solid #ddd;padding:12px;border-radius:10px;margin:12px 0">
                    <div style="opacity:.75;font-size:12px">${author} • ${esc(it.type)} • ${date}</div>
                    ${text}
                    <div style="margin-top:8px">${media}</div>
                    </div>
                `;
            }).join("\n");

        return `<!doctype html>
            <html lang="uk">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width,initial-scale=1" />
                    <title>${esc(manifest.trip?.title || "Album")}</title>
                </head>
                <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;padding:16px;max-width:900px;margin:0 auto;">
                <h2 style="margin:0 0 6px 0;">${esc(manifest.trip?.title || "Альбом")}</h2>
                <div style="opacity:.75;margin-bottom:16px;">Експорт: ${esc(manifest.exportedAt)}</div>
                ${rows || `<div style="opacity:.75">Немає спогадів</div>`}
                </body>
            </html>`;
    }
}
