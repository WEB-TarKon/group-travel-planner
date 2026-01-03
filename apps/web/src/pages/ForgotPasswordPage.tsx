import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [result, setResult] = useState<string | null>(null);
    const [devToken, setDevToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setResult(null);
        setDevToken(null);

        if (!email.trim() || !email.includes("@")) {
            setError("Введіть коректну електронну пошту.");
            return;
        }

        setLoading(true);
        try {
            const res = await apiPost<{ ok: boolean; devToken?: string }>("/auth/password-reset/request", { email });
            setResult("Якщо ця пошта існує — ми надіслали інструкції для відновлення.");
            if (res.devToken) setDevToken(res.devToken);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
            <h2>Відновлення пароля</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Електронна пошта
                    <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Надсилаємо..." : "Надіслати"}
                </button>

                {result && <div style={{ color: "green" }}>{result}</div>}
                {error && <div style={{ color: "crimson" }}>{error}</div>}

                {devToken && (
                    <div style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
                        <div style={{ marginBottom: 6 }}>
                            <b>DEV token</b> (для тесту без пошти):
                        </div>
                        <div style={{ wordBreak: "break-all" }}>{devToken}</div>
                        <div style={{ marginTop: 8 }}>
                            Перейдіть: <Link to={`/reset-password?token=${devToken}`}>Скинути пароль</Link>
                        </div>
                    </div>
                )}
            </form>

            <p style={{ marginTop: 12 }}>
                <Link to="/login">Назад до входу</Link>
            </p>
        </div>
    );
}
