import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";
import { Link } from "react-router-dom";
import { useMe } from "../useMe";

type PublicTrip = {
    id: string;
    title: string;
    isPublic: boolean;
    status: string;
    organizerId: string;
    createdAt: string;
};

export default function PublicTripsPage() {
    const me = useMe();

    const [trips, setTrips] = useState<PublicTrip[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    async function load() {
        setError(null);
        try {
            const data = await apiGet<PublicTrip[]>("/trips/public/list");
            setTrips(data);
        } catch (e) {
            setError(String(e));
        }
    }

    async function requestJoin(tripId: string) {
        setError(null);
        setMessage(null);
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/join-requests`, {});
            alert("Заявку надіслано ✅");
        } catch (e: any) {
            const msg = String(e?.message || e);
            if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("already")) {
                setMessage("Заявка вже була подана раніше ⏳");
                return;
            }
            setError(msg);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <div style={{ padding: 16 }}>
            <h2>Публічні подорожі</h2>

            <div style={{ marginBottom: 12 }}>
                <Link to="/">← Назад до моїх подорожей</Link>
            </div>

            {message && <div style={{ color: "green", marginTop: 10 }}>{message}</div>}
            {error && <div style={{ color: "crimson", marginTop: 10 }}>{error}</div>}

            <ul>
                {trips.map((t) => {
                    const isMyTrip = me?.id === t.organizerId;

                    return (
                        <li key={t.id} style={{ marginBottom: 8 }}>
                            <b>{t.title}</b> ({t.status})
                            {isMyTrip ? (
                                <span style={{ marginLeft: 8, opacity: 0.7 }}>Це ваша подорож</span>
                            ) : (
                                <button onClick={() => requestJoin(t.id)} style={{ marginLeft: 8 }}>
                                    Подати заявку
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
