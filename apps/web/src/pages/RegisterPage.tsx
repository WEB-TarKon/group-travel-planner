import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../api";
import { setToken } from "../authStorage";

function isValidEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function passwordIsStrong(v: string) {
    // мінімально: 8+ символів, 1 літера, 1 цифра
    return v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v);
}

export default function RegisterPage() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [remember, setRemember] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!name.trim()) return setError("Вкажіть ім’я.");
        if (!isValidEmail(email)) return setError("Вкажіть коректний email.");
        if (!passwordIsStrong(password))
            return setError("Пароль має бути мінімум 8 символів і містити літери та цифри.");

        setLoading(true);
        try {
            const data = await apiPost<{ accessToken: string }>("/auth/register", { name, email, password });
            setToken(data.accessToken, remember);
            navigate("/", { replace: true });
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, maxWidth: 420, margin: "0 auto" }}>
            <h2>Реєстрація</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Ім’я
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="name"
                        placeholder="Аліна"
                    />
                </label>

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
                        autoComplete="new-password"
                        placeholder="мінімум 8 символів"
                    />
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Запам’ятати мене
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Створюємо..." : "Зареєструватися"}
                </button>

                {error && <div style={{ color: "crimson" }}>{error}</div>}
            </form>

            <p style={{ marginTop: 12 }}>
                Вже є акаунт? <Link to="/login">Увійти</Link>
            </p>
        </div>
    );
}
