import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { setToken } from "../authStorage";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { GoogleLogin } from "@react-oauth/google";

function onlyLetters(value: string) {
    return /^[A-Za-zА-Яа-яІіЇїЄє'’\- ]+$/.test(value);
}

function validLogin(value: string) {
    return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}

function validTelegram(value: string) {
    if (!value.trim()) return true;
    return /^@?[a-zA-Z0-9_]{5,32}$/.test(value.trim());
}

function validPassword(value: string) {
    if (value.length < 8) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/\d/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
}

export default function RegisterPage() {
    const navigate = useNavigate();

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    const [email, setEmail] = useState("");
    const [login, setLogin] = useState("");

    const [phone, setPhone] = useState<string | undefined>(undefined);
    const [telegramUsername, setTelegramUsername] = useState("");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const hint = useMemo(() => "Пароль: великі+малі літери, цифра і спецсимвол (мін. 8)", []);

    function validate(): string | null {
        if (!firstName.trim() || !lastName.trim()) return "Заповніть ім’я та прізвище.";
        if (!onlyLetters(firstName.trim())) return "Ім’я має містити лише літери.";
        if (!onlyLetters(lastName.trim())) return "Прізвище має містити лише літери.";

        if (!email.trim() || !email.includes("@")) return "Введіть коректну електронну пошту.";

        if (!login.trim()) return "Введіть логін.";
        if (!validLogin(login.trim())) return "Логін: 3-24 символи, лише латиниця/цифри/_.";

        if (phone && phone.length < 8) return "Некоректний номер телефону.";

        if (!validTelegram(telegramUsername)) return "Некоректний Telegram username (5-32, латиниця/цифри/_).";

        if (!validPassword(password)) return hint;
        if (password !== confirmPassword) return "Паролі не співпадають.";

        return null;
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const v = validate();
        if (v) {
            setError(v);
            return;
        }

        setLoading(true);
        try {
            const data = await apiPost<{ accessToken: string }>("/auth/register", {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                email: email.trim(),
                login: login.trim(),
                phone: phone ?? undefined,
                telegramUsername: telegramUsername.trim() ? telegramUsername.trim() : undefined,
                password,
                confirmPassword,
            });

            setToken(data.accessToken, true);
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
            setToken(data.accessToken, true);
            navigate("/", { replace: true });
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
            <h2>Реєстрація</h2>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                <label>
                    Ім’я
                    <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="given-name"
                        placeholder="Введіть ім'я"
                    />
                </label>

                <label>
                    Прізвище
                    <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="family-name"
                        placeholder="Введіть прізвище"
                    />
                </label>

                <label>
                    Електронна пошта
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="email"
                        placeholder="name@example.com"
                    />
                </label>

                <label>
                    Логін
                    <input
                        value={login}
                        onChange={(e) => setLogin(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="username"
                        placeholder="login_example123"
                    />
                </label>

                <label>
                    Номер телефону
                    <div style={{ marginTop: 6 }}>
                        <PhoneInput
                            international
                            defaultCountry="UA"
                            value={phone}
                            onChange={setPhone}
                            placeholder="+380..."
                        />
                    </div>
                </label>

                <label>
                    Ім’я користувача у Telegram (необов’язково)
                    <input
                        value={telegramUsername}
                        onChange={(e) => setTelegramUsername(e.target.value)}
                        style={{ width: "100%" }}
                        placeholder="@username"
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
                            autoComplete="new-password"
                            placeholder="мінімум 8 символів"
                        />
                        <button type="button" onClick={() => setShowPassword((s) => !s)}>
                            {showPassword ? "Сховати" : "Показати"}
                        </button>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{hint}</div>
                </label>

                <label>
                    Повторити пароль
                    <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        style={{ width: "100%" }}
                        autoComplete="new-password"
                        placeholder="повторіть пароль"
                    />
                </label>

                <button type="submit" disabled={loading}>
                    {loading ? "Створюємо..." : "Зареєструватися"}
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
                Вже є акаунт? <Link to="/login">Увійти</Link>
            </p>
        </div>
    );
}
