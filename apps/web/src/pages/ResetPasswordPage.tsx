import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiPost } from "../api";

export default function ResetPasswordPage() {
    const [params] = useSearchParams();
    const tokenFromUrl = params.get("token") ?? "";

    const [token, setToken] = useState(tokenFromUrl);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [ok, setOk] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const passwordHint = useMemo(() => {
        return "Мін. 8 символів, великі+малі літери, цифра і спецсимвол";
    }, []);

    function validate(): string | null {
        if (!token.trim()) return "Немає токена.";
        if (newPassword.length < 8) return passwordHint;
        if (!/[a-z]/.test(newPassword)) return passwordHint;
        if (!/[A-Z]/.test(newPassword)) return passwordHint;
        if (!/\d/.test(newPassword)) return passwordHint;
        if (!/[^A-Za-z0-9]/.test(newPassword)) return passwordHint;
        if (newPassword !== confirmPassword) return "Паролі не співпадають.";
        return null;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setOk(false);

        const v = validate();
        if (v) {
            setError(v);
            return;
        }

        setLoading(true);
        try {
            await apiPost<{ ok: boolean }>("/auth/password-reset/confirm", {
                token,
                newPassword,
                confirmPassword,
            });
            setOk(true);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
            <h2>Скидання пароля</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Токен
                    <input value={token} onChange={(e) => setToken(e.target.value)} style={{ width: "100%" }} />
                </label>

                <label>
                    Новий пароль
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            style={{ width: "100%" }}
                            placeholder="Наприклад: Qq!23456"
                        />
                        <button type="button" onClick={() => setShowPassword((s) => !s)}>
                            {showPassword ? "Сховати" : "Показати"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{passwordHint}</div>
                </label>

                <label>
                    Повторити пароль
                    <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{ width: "100%" }}
                    />
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Зберігаємо..." : "Змінити пароль"}
                </button>

                {ok && <div style={{ color: "green" }}>Пароль змінено. Тепер можете увійти.</div>}
                {error && <div style={{ color: "crimson" }}>{error}</div>}
            </form>

            <p style={{ marginTop: 12 }}>
                <Link to="/login">Перейти до входу</Link>
            </p>
        </div>
    );
}
