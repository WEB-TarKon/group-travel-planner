import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../api";
import * as React from "react";

export default function RegisterPage() {
    const navigate = useNavigate();
    const [name, setName] = useState("Demo User");
    const [email, setEmail] = useState("demo@example.com");
    const [password, setPassword] = useState("demo12345");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const data = await apiPost<{ accessToken: string }>("/auth/register", { name, email, password });
            localStorage.setItem("accessToken", data.accessToken);
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
                    <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
                </label>

                <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%" }} />
                </label>

                <label>
                    Пароль
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: "100%" }}
                    />
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
