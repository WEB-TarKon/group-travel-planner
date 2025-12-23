import { useEffect, useState } from "react";
import { apiGet } from "../api";

type N = { id: string; title: string; message: string; createdAt: string };

export default function NotificationsPage() {
    const [items, setItems] = useState<N[]>([]);

    useEffect(() => {
        apiGet<N[]>("/notifications").then(setItems).catch(console.error);
    }, []);

    return (
        <div style={{ padding: 16 }}>
            <h2>Сповіщення</h2>
            <ul>
                {items.map((n) => (
                    <li key={n.id} style={{ marginBottom: 10 }}>
                        <b>{n.title}</b>
                        <div>{n.message}</div>
                        <small style={{ opacity: 0.7 }}>
                            {new Date(n.createdAt).toLocaleString()}
                        </small>
                    </li>
                ))}
            </ul>
        </div>
    );
}
