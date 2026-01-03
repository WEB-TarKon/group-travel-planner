import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../api";
import { getRememberMe, setRememberMe, setToken } from "../authStorage";
import { GoogleLogin } from "@react-oauth/google";

export default function LoginPage() {
    const navigate = useNavigate();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [remember, setRemember] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setRemember(getRememberMe());
    }, []);

    function onToggleRemember(v: boolean) {
        setRemember(v);
        setRememberMe(v);
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!identifier.trim() || !password) {
            setError("Заповніть логін/електронну пошту та пароль.");
            return;
        }

        setLoading(true);
        try {
            const data = await apiPost<{ accessToken: string }>("/auth/login", {
                identifier,
                password,
            });

            setToken(data.accessToken, remember);
            navigate("/", { replace: true });
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    async function onGoogleSuccess(credential: string) {
        setError(null);
        setLoading(true);
        try {
            const data = await apiPost<{ accessToken: string }>("/auth/google", { credential });
            setToken(data.accessToken, true); // Google-логін за замовчуванням “пам’ятаємо”
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
                    Логін або електронна пошта
                    <input
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="username"
                        placeholder="login або name@example.com"
                    />
                </label>

                <label>
                    Пароль
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: "100%" }}
                            autoComplete="current-password"
                            placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPassword((s) => !s)}>
                            {showPassword ? "Сховати" : "Показати"}
                        </button>
                    </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={remember} onChange={(e) => onToggleRemember(e.target.checked)} />
                    Запам’ятати мене
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Входимо..." : "Увійти"}
                </button>

                <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                    <GoogleLogin
                        onSuccess={(cred) => {
                            if (cred.credential) onGoogleSuccess(cred.credential);
                            else setError("Google: не вдалося отримати credential");
                        }}
                        onError={() => setError("Google: помилка входу")}
                    />
                </div>

                {error && <div style={{ color: "crimson" }}>{error}</div>}
            </form>

            <p style={{ marginTop: 12 }}>
                <Link to="/forgot-password">Забули пароль?</Link>
            </p>

            <p style={{ marginTop: 12 }}>
                Немає акаунта? <Link to="/register">Зареєструватися</Link>
            </p>
        </div>
    );
}
