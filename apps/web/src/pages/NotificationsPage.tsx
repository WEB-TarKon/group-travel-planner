import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";

type N = { id: string; title: string; body: string; isRead: boolean; createdAt: string };

export default function NotificationsPage() {
    const [items, setItems] = useState<N[]>([]);

    async function load() {
        const data = await apiGet<N[]>("/notifications");
        setItems(data);
    }

    async function markRead(id: string) {
        await apiPost(`/notifications/${id}/read`, {});
        await load();
    }

    useEffect(() => { load().catch(console.error); }, []);

    return (
        <div style={{ padding: 16 }}>
            <h2>Сповіщення</h2>
            <ul>
                {items.map((n) => (
                    <li key={n.id} style={{ marginBottom: 10, opacity: n.isRead ? 0.6 : 1 }}>
                        <b>{n.title}</b>
                        <div>{n.body}</div>
                        {!n.isRead && <button onClick={() => markRead(n.id)}>Прочитано</button>}
                    </li>
                ))}
            </ul>
        </div>
    );
}
