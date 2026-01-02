import { useEffect, useState } from "react";
import {apiGet, apiPost, apiPut} from "../api";

type Me = { id: string; email: string; name?: string; bankLink?: string };

export default function ProfilePage() {
    const [me, setMe] = useState<Me | null>(null);
    const [name, setName] = useState("");
    const [bankLink, setBankLink] = useState("");
    const [msg, setMsg] = useState<string | null>(null);
    const [tgCode, setTgCode] = useState<string | null>(null);
    const [tgMsg, setTgMsg] = useState<string | null>(null);

    async function genTelegramCode() {
        setTgMsg(null);
        const r = await apiPost<{ code: string }>("/telegram/link-code", {});
        setTgCode(r.code);
        setTgMsg("Код згенеровано. Відкрий Telegram і надішли боту команду /start <код>.");
    }

    async function disconnectTelegram() {
        setTgMsg(null);
        await apiPost("/telegram/disconnect", {});
        setTgCode(null);
        setTgMsg("Telegram відключено.");
        await load();
    }

    async function load() {
        const data = await apiGet<Me>("/users/me");
        setMe(data);
        setName(data.name ?? "");
        setBankLink(data.bankLink ?? "");
    }

    async function save() {
        setMsg(null);
        try {
            await apiPut<Me>("/users/me", { name, bankLink });
            setMsg("Збережено");
            await load();
        } catch (e) {
            setMsg(`Помилка: ${String(e)}`);
        }
    }

    useEffect(() => { load().catch(console.error); }, []);

    if (!me) return <div style={{ padding: 16 }}>Завантаження…</div>;

    return (
        <div style={{ padding: 16, maxWidth: 520 }}>
            <h2>Профіль</h2>
            <div>Email: {me.email}</div>

            <div style={{ marginTop: 12 }}>
                <label>Ім’я</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
            </div>

            <div style={{ marginTop: 12 }}>
                <label>Посилання на банку/рахунок (Monobank)</label>
                <input value={bankLink} onChange={(e) => setBankLink(e.target.value)} style={{ width: "100%" }} />
            </div>

            <hr style={{ margin: "16px 0" }} />
            <h3 style={{ marginTop: 0 }}>Telegram-сповіщення</h3>

            <p style={{ opacity: 0.85 }}>
                1) Натисни “Згенерувати код”<br />
                2) Відкрий нашого Telegram-бота<br />
                3) Надішли: <b>/start КОД</b><br />
                Після цього сповіщення будуть приходити в Telegram.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={genTelegramCode}>Згенерувати код</button>
                <button onClick={disconnectTelegram}>Відключити Telegram</button>
            </div>

            {tgCode && (
                <div style={{ marginTop: 10, padding: 10, border: "1px dashed #999", borderRadius: 8 }}>
                    Твій код: <b>{tgCode}</b>
                    <div style={{ marginTop: 6, opacity: 0.85 }}>
                        Скопіюй і відправ боту: <b>/start {tgCode}</b>
                    </div>
                </div>
            )}

            {tgMsg && <div style={{ marginTop: 10, opacity: 0.9 }}>{tgMsg}</div>}

            <button onClick={save} style={{ marginTop: 12 }}>Зберегти</button>
            {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
        </div>
    );
}
