import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { randomBytes, createHash } from "crypto";
import { OAuth2Client } from "google-auth-library";
import {
    RegisterDto,
    LoginDto,
    PasswordResetRequestDto,
    PasswordResetConfirmDto,
} from "./dto";
import { MailService } from "../mail/mail.service";

@Injectable()
export class AuthService {
    private googleClient: OAuth2Client;

    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private mail: MailService,
    ) {
        this.googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }

    private sign(userId: string) {
        const accessToken = this.jwt.sign({ sub: userId });
        return { accessToken };
    }

    private normalizeLogin(login: string) {
        return login.trim();
    }

    private normalizeEmail(email: string) {
        return email.trim().toLowerCase();
    }

    private normalizePhone(phone?: string) {
        if (!phone) return undefined;
        const p = phone.trim();
        return p.startsWith("+") ? p : `+${p}`;
    }

    async register(dto: RegisterDto) {
        if (dto.password !== dto.confirmPassword) {
            throw new BadRequestException("Паролі не співпадають");
        }

        const email = this.normalizeEmail(dto.email);
        const login = this.normalizeLogin(dto.login);
        const phone = this.normalizePhone(dto.phone);
        const telegramUsername = dto.telegramUsername?.trim();

        // унікальності
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { login },
                    ...(phone ? [{ phone }] : []),
                ],
            },
            select: { id: true, email: true, login: true, phone: true },
        });

        if (existing?.email === email) throw new ConflictException("Електронна пошта вже використовується");
        if (existing?.login === login) throw new ConflictException("Логін вже використовується");
        if (phone && existing?.phone === phone) throw new ConflictException("Телефон вже використовується");

        const passwordHash = await bcrypt.hash(dto.password, 10);

        const user = await this.prisma.user.create({
            data: {
                email,
                login,
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                name: `${dto.firstName.trim()} ${dto.lastName.trim()}`,
                phone,
                telegramUsername,
                passwordHash,
            },
            select: { id: true },
        });

        return this.sign(user.id);
    }

    async login(dto: LoginDto) {
        const identifier = dto.identifier.trim();
        const isEmail = identifier.includes("@");

        const user = await this.prisma.user.findFirst({
            where: isEmail
                ? { email: this.normalizeEmail(identifier) }
                : { login: this.normalizeLogin(identifier) },
        });

        if (!user) throw new UnauthorizedException("Невірний логін/email або пароль");

        const ok = await bcrypt.compare(dto.password, user.passwordHash);
        if (!ok) throw new UnauthorizedException("Невірний логін/email або пароль");

        return this.sign(user.id);
    }

    // ---------- Google ----------
    private async ensureGoogleClientConfigured() {
        if (!process.env.GOOGLE_CLIENT_ID) {
            throw new BadRequestException("GOOGLE_CLIENT_ID не налаштовано на бекенді");
        }
    }

    async googleAuth(idToken: string) {
        await this.ensureGoogleClientConfigured();

        const ticket = await this.googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload?.email ? this.normalizeEmail(payload.email) : null;

        if (!email) throw new UnauthorizedException("Google auth: немає email");

        let user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            const givenName = (payload?.given_name ?? "User").trim();
            const familyName = (payload?.family_name ?? "Google").trim();

            // генеруємо унікальний login
            const base = (payload?.email?.split("@")[0] ?? "user").replace(/[^a-zA-Z0-9_]/g, "_");
            let login = base.slice(0, 20) || "user";
            for (let i = 0; i < 20; i++) {
                const exists = await this.prisma.user.findUnique({ where: { login } });
                if (!exists) break;
                login = `${base.slice(0, 16)}_${Math.floor(Math.random() * 9000 + 1000)}`;
            }

            const randomPass = randomBytes(32).toString("hex");
            const passwordHash = await bcrypt.hash(randomPass, 10);

            user = await this.prisma.user.create({
                data: {
                    email,
                    login,
                    firstName: givenName,
                    lastName: familyName,
                    name: `${givenName} ${familyName}`,
                    passwordHash,
                },
            });
        }

        return this.sign(user.id);
    }

    // ---------- Reset password ----------
    private hashResetToken(raw: string) {
        return createHash("sha256").update(raw).digest("hex");
    }

    async requestPasswordReset(dto: PasswordResetRequestDto) {
        const email = this.normalizeEmail(dto.email);

        const user = await this.prisma.user.findUnique({ where: { email } });

        // ВАЖЛИВО: не палимо, чи існує email
        if (!user) return { ok: true };

        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = this.hashResetToken(rawToken);

        const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 хв

        await this.prisma.passwordResetToken.create({
            data: {
                tokenHash,
                userId: user.id,
                expiresAt,
            },
        });

        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

        // реально відправляємо лист
        await this.mail.sendPasswordResetEmail(email, resetUrl);

        return { ok: true };
    }

    async confirmPasswordReset(dto: PasswordResetConfirmDto) {
        if (dto.newPassword !== dto.confirmPassword) {
            throw new BadRequestException("Паролі не співпадають");
        }

        const tokenHash = this.hashResetToken(dto.token);

        const rec = await this.prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });

        if (!rec) throw new NotFoundException("Токен недійсний");
        if (rec.usedAt) throw new BadRequestException("Токен вже використано");
        if (rec.expiresAt.getTime() < Date.now()) throw new BadRequestException("Токен протермінований");

        const passwordHash = await bcrypt.hash(dto.newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: rec.userId },
                data: { passwordHash },
            }),
            this.prisma.passwordResetToken.update({
                where: { tokenHash },
                data: { usedAt: new Date() },
            }),
        ]);

        return { ok: true };
    }
}
