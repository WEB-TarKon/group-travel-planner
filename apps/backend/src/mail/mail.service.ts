import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    private transporter() {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT || "587");
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (!host || !user || !pass) {
            throw new Error("SMTP is not configured. Check SMTP_HOST/SMTP_USER/SMTP_PASS in .env");
        }

        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // 465 = SSL, 587 = STARTTLS
            auth: { user, pass },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendPasswordResetEmail(to: string, resetUrl: string) {
        const from = process.env.MAIL_FROM || process.env.SMTP_USER;

        const subject = "Відновлення пароля — Group Travel Planner";

        const text = `Ви запросили відновлення пароля.
Перейдіть за посиланням, щоб встановити новий пароль:
${resetUrl}

Якщо це були не ви — просто ігноруйте цей лист.`;

        const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Відновлення пароля</h2>
        <p>Ви запросили відновлення пароля для акаунта.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 16px;border-radius:10px;background:#111;color:#fff;text-decoration:none">
            Скинути пароль
          </a>
        </p>
        <p style="color:#555;font-size:13px">
          Якщо кнопка не працює, відкрийте це посилання:
          <br/>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="color:#777;font-size:12px">
          Якщо це були не ви — просто ігноруйте цей лист.
        </p>
      </div>
    `;

        const tr = this.transporter();

        const info = await tr.sendMail({
            from,
            to,
            subject,
            text,
            html,
        });

        this.logger.log(`Password reset email sent to ${to}. messageId=${info.messageId}`);
    }

    async verify() {
        const tr = this.transporter();
        await tr.verify();
        this.logger.log("SMTP transporter verified ✅");
    }
}
