import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../api";

type Trip = { id: string; title: string; isPublic: boolean; status: string };

export default function TripsPage() {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [title, setTitle] = useState("Тестова подорож");

    async function load() {
        const data = await apiGet<Trip[]>("/trips");
        setTrips(data);
    }

    async function createTrip() {
        // для MVP organizerId можна тимчасово “зашити”
        const created = await apiPost<Trip>("/trips", { title, isPublic: false, organizerId: "demo-organizer" });
        setTitle("Тестова подорож");
        setTrips([created, ...trips]);
    }

    useEffect(() => {
        load().catch(console.error);
    }, []);

    return (
        <div style={{ padding: 16 }}>
            <h2>Мої подорожі</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
                <button onClick={createTrip}>Створити</button>
            </div>

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
