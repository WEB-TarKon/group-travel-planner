import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api";
import { useNavigate } from "react-router-dom";

type N = {
    id: string;
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
    tripId?: string | null;
};

export default function NotificationsPage() {
    const nav = useNavigate();
    const [items, setItems] = useState<N[]>([]);
    const [loading, setLoading] = useState(false);

    const unread = useMemo(() => items.filter((x) => !x.isRead).length, [items]);

    async function load() {
        setLoading(true);
        try {
            const data = await apiGet<N[]>("/notifications");
            setItems(data);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load().catch(console.error);
    }, []);

    async function markRead(id: string) {
        await apiPost(`/notifications/${id}/read`, {});
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    }

    async function markAllRead() {
        await apiPost(`/notifications/read-all`, {});
        setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    }

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>Сповіщення</h2>

                <button onClick={load} disabled={loading}>
                    {loading ? "Оновлюю..." : "Оновити"}
                </button>

                <button onClick={markAllRead} disabled={unread === 0}>
                    Позначити всі прочитаними ({unread})
                </button>
            </div>

            <ul style={{ marginTop: 12 }}>
                {items.map((n) => (
                    <li
                        key={n.id}
                        style={{
                            marginBottom: 12,
                            padding: 10,
                            border: "1px solid #ddd",
                            borderRadius: 8,
                            opacity: n.isRead ? 0.7 : 1,
                        }}
                    >
                        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
                            <b>
                                {!n.isRead ? "🔵 " : ""}
                                {n.title}
                            </b>

                            {!n.isRead && (
                                <button onClick={() => markRead(n.id)} style={{ whiteSpace: "nowrap" }}>
                                    Прочитано
                                </button>
                            )}
                        </div>

                        <div style={{ marginTop: 6 }}>{n.message}</div>

                        <div style={{ marginTop: 6, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <small style={{ opacity: 0.7 }}>{new Date(n.createdAt).toLocaleString()}</small>

                            {n.tripId && (
                                <button onClick={() => nav(`/trips/${n.tripId}`)} style={{ whiteSpace: "nowrap" }}>
                                    Відкрити подорож
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
