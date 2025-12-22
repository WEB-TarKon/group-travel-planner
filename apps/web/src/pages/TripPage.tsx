import {MapContainer, Marker, Popup, TileLayer, useMapEvents} from "react-leaflet";
import {useParams} from "react-router-dom";
import {apiGet, apiPost} from "../api";
import {useEffect, useMemo, useRef, useState} from "react";
import type {Map as LeafletMap} from "leaflet";
import {Polyline} from "react-leaflet";

type Waypoint = { order: number; lat: number; lng: number; title?: string };
type Trip = { id: string; title: string; waypoints?: Waypoint[] };

function ClickToAdd({onAdd}: { onAdd: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onAdd(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function TripPage() {
    const {id} = useParams();
    const tripId = id ?? "";
    const [trip, setTrip] = useState<Trip | null>(null);
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const mapRef = useRef<LeafletMap | null>(null);


    const center: [number, number] = useMemo(() => {
        if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lng];
        return [50.4501, 30.5234];
    }, [waypoints]);

    useEffect(() => {
        (async () => {
            const data = await apiGet<Trip>(`/trips/${tripId}`);
            setTrip(data);
            await loadRequests();
            setWaypoints(data.waypoints ?? []);
        })().catch(console.error);
    }, [tripId]);

    useEffect(() => {
        const t = setTimeout(() => {
            mapRef.current?.invalidateSize();
        }, 0);
        return () => clearTimeout(t);
    }, []);


    function addWaypoint(lat: number, lng: number) {
        const next: Waypoint = {order: waypoints.length, lat, lng, title: `Точка ${waypoints.length + 1}`};
        setWaypoints([...waypoints, next]);
    }

    function removeWaypoint(order: number) {
        const filtered = waypoints.filter((w) => w.order !== order);
        const reindexed = filtered.map((w, idx) => ({...w, order: idx, title: `Точка ${idx + 1}`}));
        setWaypoints(reindexed);
    }

    async function save() {
        await apiPost(`/trips/${tripId}/waypoints`, {waypoints});
        alert("Збережено");
    }

    async function loadRequests() {
        try {
            const data = await apiGet<any[]>(`/trips/${tripId}/join-requests`);
            setRequests(data);
        } catch {
            // якщо не організатор — бек відмовить, це нормально: просто не показуємо
            setRequests([]);
        }
    }

    async function approve(requestId: string) {
        await apiPost(`/trips/${tripId}/join-requests/${requestId}/approve`, {});
        await loadRequests();
        alert("Учасника додано ✅");
    }

    async function reject(requestId: string) {
        await apiPost(`/trips/${tripId}/join-requests/${requestId}/reject`, {});
        await loadRequests();
        alert("Заявку відхилено");
    }

    if (!trip) return <div style={{padding: 16}}>Завантаження…</div>;

    const polylinePositions: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);

    return (
        <div style={{position: "fixed", inset: 0, display: "flex"}}>
            <div
                style={{
                    width: 320,
                    padding: 16,
                    overflow: "auto",
                    borderRight: "1px solid #ddd",
                }}
            >
                <h3>{trip.title}</h3>
                <p>Клікни на карту — додаси точку маршруту.</p>

                <button onClick={save} style={{marginBottom: 12}}>
                    Зберегти точки
                </button>
                <button onClick={() => setWaypoints([])} style={{marginBottom: 12}}>
                    Очистити маршрут
                </button>

                <ol>
                    {waypoints.map((w) => (
                        <li key={w.order}>
                            {w.title} — {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                            <button onClick={() => removeWaypoint(w.order)} style={{marginLeft: 8}}>
                                Видалити
                            </button>
                        </li>
                    ))}
                </ol>

                {requests.length > 0 && (
                    <>
                        <h4 style={{marginTop: 16}}>Заявки на участь</h4>
                        <ul>
                            {requests.map((r) => (
                                <li key={r.id} style={{marginBottom: 8}}>
                                    {r.user?.name ?? r.user?.email ?? r.userId}
                                    <button onClick={() => approve(r.id)} style={{marginLeft: 8}}>
                                        Прийняти
                                    </button>
                                    <button onClick={() => reject(r.id)} style={{marginLeft: 8}}>
                                        Відхилити
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div style={{flex: 1, minWidth: 0}}>
                <MapContainer
                    center={center}
                    zoom={12}
                    style={{height: "100%", width: "100%"}}
                    ref={mapRef}
                >

                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap contributors'
                    />

                    {polylinePositions.length >= 2 && <Polyline positions={polylinePositions}/>}

                    <ClickToAdd onAdd={addWaypoint}/>
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
