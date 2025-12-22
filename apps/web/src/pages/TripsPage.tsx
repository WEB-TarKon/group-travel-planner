import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../api";

type Trip = { id: string; title: string; isPublic: boolean; status: string };

export default function TripsPage() {
    const navigate = useNavigate();

    const [trips, setTrips] = useState<Trip[]>([]);
    const [title, setTitle] = useState("Тестова подорож");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

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
            const created = await apiPost<Trip>("/trips", { title, isPublic: false });

            setTitle("Тестова подорож");

            setTrips((prev) => [created, ...prev]);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    function logout() {
        localStorage.removeItem("accessToken");
        navigate("/login", { replace: true });
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Мої подорожі</h2>
                <button onClick={logout}>Вийти</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
                <button onClick={createTrip} disabled={loading}>
                    {loading ? "Створюю..." : "Створити"}
                </button>
            </div>

            {error && <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>}

            <ul>
                {trips.map((t) => (
                    <li key={t.id}>
                        <Link to={`/trips/${t.id}`}>{t.title}</Link> ({t.status})
                    </li>
                ))}
            </ul>
        </div>
    );
}
