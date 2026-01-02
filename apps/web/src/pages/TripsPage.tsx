import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { clearToken } from "../authStorage";

type Trip = { id: string; title: string; isPublic: boolean; status: string };

export default function TripsPage() {
    const navigate = useNavigate();

    const [trips, setTrips] = useState<Trip[]>([]);
    const [title, setTitle] = useState("Тестова подорож");
    const [isPublic, setIsPublic] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const [unreadCount, setUnreadCount] = useState(0);

    async function loadUnread() {
        try {
            const r = await apiGet<{ count: number }>("/notifications/unread-count");
            setUnreadCount(r.count);
        } catch {}
    }

    useEffect(() => {
        loadUnread();
        const t = setInterval(loadUnread, 25000);
        return () => clearInterval(t);
    }, []);

    async function load() {
        setError(null);
        try {
            const data = await apiGet<Trip[]>("/trips");
            setTrips(data);
        } catch (e) {
            setError(String(e));
        }
    }

    async function createTrip() {
        setError(null);
        setLoading(true);

        try {
            const created = await apiPost<Trip>("/trips", { title, isPublic });

            setTitle("Тестова подорож");
            setIsPublic(false);

            setTrips((prev) => [created, ...prev]);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        clearToken();
        navigate("/login", { replace: true });
    }

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        loadUnread();
    }, []);


    return (
        <div style={{ padding: 16 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                }}
            >
                <h2 style={{ margin: 0 }}>Мої подорожі</h2>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Link to="/profile">Профіль</Link>
                    <Link to="/notifications" style={{ position: "relative", padding: "6px 10px" }}>
                        🔔
                        {unreadCount > 0 && (
                            <span
                                style={{
                                    position: "absolute",
                                    top: -4,
                                    right: -4,
                                    fontSize: 12,
                                    padding: "2px 6px",
                                    borderRadius: 999,
                                    background: "crimson",
                                    color: "white",
                                }}
                            >
      {unreadCount}
    </span>
                        )}
                    </Link>


                    <button onClick={logout}>Вийти</button>
                </div>
            </div>

            <div style={{ marginBottom: 12 }}>
                <Link to="/public">Перейти до публічних подорожей</Link>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                    Публічна
                </label>

                <button onClick={createTrip} disabled={loading}>
                    {loading ? "Створюю..." : "Створити"}
                </button>
            </div>

            {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

            <ul>
                {trips.map((t) => (
                    <li key={t.id}>
                        <Link to={`/trips/${t.id}`}>{t.title}</Link> ({t.status}) {t.isPublic ? "🌍" : "🔒"}
                    </li>
                ))}
            </ul>
        </div>
    );
}
