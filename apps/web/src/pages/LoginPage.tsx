import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../api";
import { setToken } from "../authStorage";

export default function LoginPage() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password) {
            setError("Заповніть email та пароль.");
            return;
        }

        setLoading(true);
        try {
            const data = await apiPost<{ accessToken: string }>("/auth/login", { email, password });
            setToken(data.accessToken, remember);
            navigate("/", { replace: true });
        } catch (err) {
            // дружнє повідомлення буде після фіксу api.ts (пункт 3)
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
            <h2>Вхід</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Email
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="email"
                        placeholder="name@example.com"
                    />
                </label>

                <label>
                    Пароль
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="current-password"
                        placeholder="••••••••"
                    />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Запам’ятати мене
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Входимо..." : "Увійти"}
                </button>

                {error && <div style={{ color: "crimson" }}>{error}</div>}
            </form>

            <p style={{ marginTop: 12 }}>
                Немає акаунта? <Link to="/register">Зареєструватися</Link>
            </p>
        </div>
    );
}
