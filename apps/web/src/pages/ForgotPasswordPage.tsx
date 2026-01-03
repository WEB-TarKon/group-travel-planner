import { useState } from "react";
import { apiPost } from "../api";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function submit() {
        setError(null);

        const v = email.trim();
        if (!v) {
            setError("Введіть електронну пошту.");
            return;
        }
        // мінімальна перевірка email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            setError("Некоректна електронна пошта.");
            return;
        }

        setLoading(true);
        try {
            await apiPost("/auth/password-reset/request", { email: v });
            setSent(true);
        } catch (e: any) {
            setError(e?.message || "Не вдалося відправити запит.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Відновлення пароля</h2>

            {sent ? (
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Якщо ця пошта існує — ми надіслали інструкції для відновлення.
                    </div>
                    <div style={{ opacity: 0.85, fontSize: 14 }}>
                        Перевірте <b>Вхідні</b>, <b>Промоакції</b> або <b>Спам</b>.
                        Лист може прийти протягом 1–2 хвилин.
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button onClick={() => setSent(false)}>Надіслати ще раз</button>
                        <Link to="/login" style={{ alignSelf: "center" }}>
                            Повернутися до входу
                        </Link>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {error && <div style={{ color: "crimson" }}>{error}</div>}

                    <label>
                        Електронна пошта
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            style={{ width: "100%" }}
                        />
                    </label>

                    <button onClick={submit} disabled={loading}>
                        {loading ? "Надсилаємо…" : "Надіслати інструкції"}
                    </button>

                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                        Ми завжди показуємо одне й те саме повідомлення, щоб не підказувати,
                        чи є пошта в системі.
                    </div>
                </div>
            )}
        </div>
    );
}
