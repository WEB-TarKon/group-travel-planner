import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MemoryType, TripStatus } from "@prisma/client";
import archiver from "archiver";
import * as path from "path";
import * as fs from "fs";
import { Response } from "express";
import PDFDocument from "pdfkit";

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

    async doneStatus(tripId: string, userId: string) { // Змініть назву аргументу organizerId -> userId
        // Було: await this.ensureOrganizer(tripId, userId);

        // Стало: Дозволяємо перегляд усім учасникам
        await this.ensureMember(tripId, userId);

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

    // -----------------------------------------------------------------------
    // 1. МЕТОД ЕКСПОРТУ (ZIP + PDF + HTML)
    // -----------------------------------------------------------------------
    async exportAlbumZip(tripId: string, userId: string, res: Response) {
        // --- 1. Перевірка доступу ---
        const trip = await this.prisma.trip.findUnique({
            where: { id: tripId },
            select: { id: true, title: true, organizerId: true, status: true },
        });
        if (!trip) throw new Error("Trip not found");

        const isOrganizer = trip.organizerId === userId;
        const member = await this.prisma.tripMember.findFirst({
            where: { tripId, userId },
            select: { id: true },
        });

        if (!isOrganizer && !member) throw new Error("Forbidden");

        // --- 2. Завантаження даних ---
        const memories = await this.prisma.tripMemory.findMany({
            where: { tripId },
            orderBy: { createdAt: "asc" },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        // --- 3. Налаштування ZIP ---
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.on("warning", (err) => console.warn("ARCHIVER WARNING:", err));
        archive.pipe(res);

        // --- 4. Налаштування PDF ---
        const doc = new PDFDocument({ margin: 50 });
        archive.append(doc as any, { name: "album.pdf" });

        const fontPath = path.join(process.cwd(), "fonts", "Roboto-Italic.ttf");
        if (fs.existsSync(fontPath)) {
            doc.font(fontPath);
        } else {
            console.warn("Шрифт не знайдено! Кирилиця може не відображатись.");
        }

        // Заголовок PDF
        doc.fontSize(24).text(trip.title, { align: "center" });
        doc.moveDown(2);

        // --- 5. Підготовка змінних для циклу ---
        const htmlItems: any[] = [];
        const uploadsRoot = path.join(process.cwd(), "uploads");

        // --- 6. ГОЛОВНИЙ ЦИКЛ ПО СПОГАДАХ ---
        for (const m of memories) {
            const authorName = m.user?.name || m.user?.email || "Учасник";
            const dateStr = new Date(m.createdAt).toLocaleString();

            // === ЧАСТИНА А: ФАЙЛИ ТА HTML ===
            let safeFileName: string | null = null;
            let finalFilePath: string | null = null;

            if (m.fileUrl) {
                // Очистка шляху до файлу
                const clean = String(m.fileUrl).replace(/^https?:\/\/[^/]+/i, "");
                const rel = clean.startsWith("/") ? clean.slice(1) : clean;
                const relFromUploads = rel.replace(/^uploads[\\/]/, "");

                finalFilePath = path.join(uploadsRoot, relFromUploads);
                const normalized = path.normalize(finalFilePath);

                // Якщо файл реально існує на диску
                if (normalized.startsWith(path.normalize(uploadsRoot)) && fs.existsSync(normalized)) {
                    safeFileName = m.fileName
                        ? `${new Date(m.createdAt).toISOString().slice(0, 10)}_${m.id}_${m.fileName}`
                        : `${new Date(m.createdAt).toISOString().slice(0, 10)}_${m.id}_${path.basename(normalized)}`;

                    // Додаємо файл фізично в архів у папку files/
                    archive.file(normalized, { name: path.join("files", safeFileName) });
                }
            }

            // Додаємо дані в масив для генерації HTML
            htmlItems.push({
                id: m.id,
                type: m.type,
                text: m.text ?? null,
                createdAt: m.createdAt,
                author: { name: authorName },
                safeFileNameInZip: safeFileName
            });

            // === ЧАСТИНА Б: ЗАПОВНЕННЯ PDF ===

            // ВАЖЛИВО: Якщо це ВІДЕО або АУДІО — пропускаємо запис у PDF повністю.
            // (Нічого не пишемо: ні автора, ні дати, ні тексту).
            if (m.type !== 'TEXT' && m.type !== 'PHOTO') {
                continue;
            }

            // Якщо дійшли сюди, значить це TEXT або PHOTO

            // 1. Заголовок спогаду (Автор • Дата)
            doc.fontSize(10).fillColor("grey").text(`${authorName} • ${dateStr}`);
            doc.fontSize(12).fillColor("black");

            // 2. Текст спогаду (якщо є)
            if (m.text) {
                doc.moveDown(0.5);
                doc.text(m.text);
            }

            // 3. Фото (якщо є і файл існує)
            if (m.type === 'PHOTO' && finalFilePath && fs.existsSync(finalFilePath)) {
                try {
                    doc.moveDown(0.5);
                    // fit: [450, 400] — щоб картинка влізла на сторінку А4
                    doc.image(finalFilePath, { fit: [450, 400], align: 'center' });
                } catch (e) {
                    console.error("Не вдалося додати фото в PDF:", e);
                }
            }

            // 4. Розділова лінія
            doc.moveDown(2);
            doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor("#eeeeee").stroke();
            doc.moveDown(1);
        }

        // Завершуємо PDF
        doc.end();

        // --- 7. ГЕНЕРАЦІЯ HTML ---
        const htmlContent = this.buildAlbumHtml({
            trip: { title: trip.title, status: trip.status },
            // exportedAt: new Date(), // Можна передати, але ми його видалили з відображення
            items: htmlItems
        });

        archive.append(htmlContent, { name: "index.html" });

        // Фіналізація архіву
        await archive.finalize();
    }

    // -----------------------------------------------------------------------
    // 2. МЕТОД ГЕНЕРАЦІЇ HTML
    // -----------------------------------------------------------------------
    private buildAlbumHtml(manifest: any) {
        const esc = (s: any) =>
            String(s ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;");

        const rows = (manifest.items || [])
            .map((it: any) => {
                const author = esc(it.author?.name || it.author?.email || "Учасник");
                const date = esc(new Date(it.createdAt).toLocaleString());

                // Текст спогаду
                const text = it.text
                    ? `<div style="margin:6px 0; white-space: pre-wrap;">${esc(it.text)}</div>`
                    : "";

                let media = "";
                // Логіка відображення медіа (Фото/Відео/Аудіо)
                if (it.safeFileNameInZip) {
                    const filePath = `files/${esc(it.safeFileNameInZip)}`;

                    if (it.type === "PHOTO") {
                        media = `<img src="${filePath}" style="max-width:100%; border-radius:8px;" />`;
                    } else if (it.type === "VIDEO") {
                        media = `<video src="${filePath}" controls style="max-width:100%; border-radius:8px;"></video>`;
                    } else if (it.type === "AUDIO") {
                        media = `<audio src="${filePath}" controls></audio>`;
                    } else {
                        media = `<a href="${filePath}" target="_blank">Відкрити файл</a>`;
                    }
                }

                return `
                    <div style="border:1px solid #ddd; padding:12px; border-radius:10px; margin:12px 0; background: #fff;">
                        <div style="opacity:.75; font-size:12px; margin-bottom: 4px;">${author} • ${esc(it.type)} • ${date}</div>
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
                    <style>
                        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #f9f9f9; color: #333; }
                        h2 { margin-top: 0; margin-bottom: 20px; text-align: center; }
                    </style>
                </head>
                <body>
                    <h2>${esc(manifest.trip?.title || "Альбом")}</h2>
                    ${rows || `<div style="opacity:.75; text-align:center;">Немає спогадів</div>`}
                </body>
            </html>`;
    }
}
