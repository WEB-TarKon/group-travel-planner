import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";

type Waypoint = { order: number; lat: number; lng: number; title?: string };
type Trip = { id: string; title: string; waypoints?: Waypoint[] };

function ClickToAdd({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onAdd(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function TripPage() {
    const { id } = useParams();
    const tripId = id ?? "";
    const [trip, setTrip] = useState<Trip | null>(null);
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

    const center: [number, number] = useMemo(() => {
        if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lng];
        return [50.4501, 30.5234];
    }, [waypoints]);

    useEffect(() => {
        (async () => {
            const data = await apiGet<Trip>(`/trips/${tripId}`);
            setTrip(data);
            setWaypoints(data.waypoints ?? []);
        })().catch(console.error);
    }, [tripId]);

    function addWaypoint(lat: number, lng: number) {
        const next: Waypoint = { order: waypoints.length, lat, lng, title: `Точка ${waypoints.length + 1}` };
        setWaypoints([...waypoints, next]);
    }

    async function save() {
        await apiPost(`/trips/${tripId}/waypoints`, { waypoints });
        alert("Збережено");
    }

    if (!trip) return <div style={{ padding: 16 }}>Завантаження…</div>;

    return (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100vh" }}>
            <div style={{ padding: 16, overflow: "auto", borderRight: "1px solid #ddd" }}>
                <h3>{trip.title}</h3>
                <p>Клікни на карту — додаси точку маршруту.</p>

                <button onClick={save} style={{ marginBottom: 12 }}>Зберегти точки</button>

                <ol>
                    {waypoints.map((w) => (
                        <li key={w.order}>
                            {w.title} — {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                        </li>
                    ))}
                </ol>
            </div>

            <div style={{ height: "100%", width: "100%" }}>
                <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />
                    <ClickToAdd onAdd={addWaypoint} />
                    {waypoints.map((w) => (
                        <Marker key={w.order} position={[w.lat, w.lng]}>
                            <Popup>{w.title}</Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
