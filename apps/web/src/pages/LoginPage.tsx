import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../api";
import * as React from "react";

export default function LoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("demo@example.com");
    const [password, setPassword] = useState("demo12345");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const data = await apiPost<{ accessToken: string }>("/auth/login", { email, password });
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
            <h2>Вхід</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
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
