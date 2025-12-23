import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";

type Me = { id: string; email: string; name?: string; bankLink?: string };

export default function ProfilePage() {
    const [me, setMe] = useState<Me | null>(null);
    const [name, setName] = useState("");
    const [bankLink, setBankLink] = useState("");
    const [msg, setMsg] = useState<string | null>(null);

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

            <button onClick={save} style={{ marginTop: 12 }}>Зберегти</button>
            {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
        </div>
    );
}
