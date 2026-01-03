import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { apiPost } from "../api";

function validatePassword(p: string) {
    if (p.length < 8) return "Пароль має бути мінімум 8 символів.";
    if (!/[a-z]/.test(p)) return "Пароль має містити хоча б одну малу літеру.";
    if (!/[A-Z]/.test(p)) return "Пароль має містити хоча б одну велику літеру.";
    if (!/[0-9]/.test(p)) return "Пароль має містити хоча б одну цифру.";
    return null;
}

export default function ResetPasswordPage() {
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    const token = useMemo(() => sp.get("token") || "", [sp]);

    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [show, setShow] = useState(false);

    const [ok, setOk] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function submit() {
        setError(null);

        if (!token) {
            setError("Немає токена. Відкрийте посилання з листа ще раз.");
            return;
        }

        const e = validatePassword(password);
        if (e) {
            setError(e);
            return;
        }

        if (password !== password2) {
            setError("Паролі не співпадають.");
            return;
        }

        setLoading(true);
        try {
            await apiPost("/auth/password-reset/confirm", {
                token,
                newPassword: password,
                confirmPassword: password2,
            });
            setOk(true);
            setTimeout(() => navigate("/login"), 800);
        } catch (e: any) {
            setError(e?.message || "Не вдалося змінити пароль.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
            <h2 style={{ marginTop: 0 }}>Новий пароль</h2>

            {ok ? (
                <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
                    <b>Пароль успішно змінено ✅</b>
                    <div style={{ opacity: 0.85, marginTop: 6 }}>Зараз перекинемо на сторінку входу…</div>
                    <div style={{ marginTop: 10 }}>
                        <Link to="/login">Перейти до входу</Link>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gap: 10 }}>
                    {error && <div style={{ color: "crimson" }}>{error}</div>}

                    <label>
                        Новий пароль
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                type={show ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ width: "100%" }}
                            />
                            <button type="button" onClick={() => setShow((v) => !v)} style={{ whiteSpace: "nowrap" }}>
                                {show ? "Сховати" : "Показати"}
                            </button>
                        </div>
                    </label>

                    <label>
                        Повторіть пароль
                        <input
                            type={show ? "text" : "password"}
                            value={password2}
                            onChange={(e) => setPassword2(e.target.value)}
                            style={{ width: "100%" }}
                        />
                    </label>

                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                        Вимоги: мін. 8 символів, великі+малі літери та цифра.
                    </div>

                    <button onClick={submit} disabled={loading}>
                        {loading ? "Зберігаємо…" : "Змінити пароль"}
                    </button>

                    <Link to="/login" style={{ fontSize: 14 }}>
                        Повернутися до входу
                    </Link>
                </div>
            )}
        </div>
    );
}
