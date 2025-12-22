import { MapContainer, Marker, Popup, TileLayer, useMapEvents, Polyline } from "react-leaflet";
import { useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useMe } from "../useMe";

type Waypoint = { order: number; lat: number; lng: number; title?: string };
type Trip = { id: string; title: string; organizerId: string; waypoints?: Waypoint[] };

function ClickToAdd({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onAdd(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

export default function TripPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const tripId = id ?? "";

    const me = useMe();

    const [trip, setTrip] = useState<Trip | null>(null);
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);

    const mapRef = useRef<LeafletMap | null>(null);

    const canEditRoute = !!(me && trip && me.id === trip.organizerId);

    const center: [number, number] = useMemo(() => {
        if (waypoints.length > 0) return [waypoints[0].lat, waypoints[0].lng];
        return [50.4501, 30.5234];
    }, [waypoints]);

    const polylinePositions: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);

    useEffect(() => {
        if (!trip) return;

        if (canEditRoute) {
            loadRequests().catch(() => setRequests([]));
        } else {
            setRequests([]);
        }
    }, [trip?.id, canEditRoute]);

    useEffect(() => {
        (async () => {
            const data = await apiGet<Trip>(`/trips/${tripId}`);
            setTrip(data);
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
        if (!canEditRoute) return; // страховка
        const next: Waypoint = {
            order: waypoints.length,
            lat,
            lng,
            title: `Точка ${waypoints.length + 1}`,
        };
        setWaypoints([...waypoints, next]);
    }

    function removeWaypoint(order: number) {
        if (!canEditRoute) return; // страховка
        const filtered = waypoints.filter((w) => w.order !== order);
        const reindexed = filtered.map((w, idx) => ({ ...w, order: idx, title: `Точка ${idx + 1}` }));
        setWaypoints(reindexed);
    }

    async function save() {
        if (!canEditRoute) return;
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/waypoints`, { waypoints });
            alert("Збережено");
        } catch (e) {
            setError(String(e));
        }
    }

    async function loadRequests() {
        try {
            const data = await apiGet<any[]>(`/trips/${tripId}/join-requests`);
            setRequests(data);
        } catch {
            // якщо не організатор — бек відмовить, це нормально
            setRequests([]);
        }
    }

    async function approve(requestId: string) {
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/join-requests/${requestId}/approve`, {});
            await loadRequests();
            alert("Учасника додано ✅");
        } catch (e) {
            setError(String(e));
        }
    }

    async function reject(requestId: string) {
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/join-requests/${requestId}/reject`, {});
            await loadRequests();
            alert("Заявку відхилено");
        } catch (e) {
            setError(String(e));
        }
    }

    // ✅ ПУНКТ 8: Видалення подорожі (тільки організатор)
    async function deleteTrip() {
        if (!canEditRoute) return;

        const ok = confirm("Видалити подорож назавжди? Це також видалить точки маршруту та заявки.");
        if (!ok) return;

        setError(null);
        try {
            await apiDelete(`/trips/${tripId}`);
            alert("Подорож видалено ✅");
            navigate("/", { replace: true });
        } catch (e) {
            setError(String(e));
        }
    }

    if (!trip) return <div style={{ padding: 16 }}>Завантаження…</div>;

    return (
        <div style={{ position: "fixed", inset: 0, display: "flex" }}>
            <div
                style={{
                    width: 340,
                    padding: 16,
                    overflow: "auto",
                    borderRight: "1px solid #ddd",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{trip.title}</h3>

                    <button onClick={() => navigate("/")} style={{ height: 32 }}>
                        ← Назад
                    </button>
                </div>

                {error && <div style={{ color: "crimson", marginTop: 10 }}>{error}</div>}

                <div style={{ marginTop: 12 }}>
                    {canEditRoute ? (
                        <p>Клікни на карту — додаси точку маршруту.</p>
                    ) : (
                        <p style={{ opacity: 0.8 }}>Маршрут може редагувати тільки організатор.</p>
                    )}

                    {/* ✅ кнопки тільки для організатора */}
                    {canEditRoute && (
                        <>
                            <button onClick={save} style={{ marginBottom: 10, display: "block", width: "100%" }}>
                                Зберегти точки
                            </button>

                            <button
                                onClick={() => setWaypoints([])}
                                style={{ marginBottom: 10, display: "block", width: "100%" }}
                            >
                                Очистити маршрут
                            </button>

                            {/* ✅ ПУНКТ 8: кнопка видалення */}
                            <button
                                onClick={deleteTrip}
                                style={{ marginBottom: 14, display: "block", width: "100%" }}
                            >
                                Видалити подорож
                            </button>
                        </>
                    )}
                </div>

                <h4 style={{ margin: "10px 0" }}>Точки</h4>
                <ol>
                    {waypoints.map((w) => (
                        <li key={w.order}>
                            {w.title} — {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                            {/* ✅ “Видалити точку” тільки для організатора */}
                            {canEditRoute && (
                                <button onClick={() => removeWaypoint(w.order)} style={{ marginLeft: 8 }}>
                                    Видалити
                                </button>
                            )}
                        </li>
                    ))}
                </ol>

                {/* ✅ заявки бачить тільки організатор (бо бек віддає лише йому) */}
                {requests.length > 0 && (
                    <>
                        <h4 style={{ marginTop: 16 }}>Заявки на участь</h4>
                        <ul>
                            {requests.map((r) => (
                                <li key={r.id} style={{ marginBottom: 8 }}>
                                    {r.user?.name ?? r.user?.email ?? r.userId}
                                    <button onClick={() => approve(r.id)} style={{ marginLeft: 8 }}>
                                        Прийняти
                                    </button>
                                    <button onClick={() => reject(r.id)} style={{ marginLeft: 8 }}>
                                        Відхилити
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} ref={mapRef}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />

                    {polylinePositions.length >= 2 && <Polyline positions={polylinePositions} />}

                    {/* ✅ клік-додавання тільки для організатора */}
                    {canEditRoute && <ClickToAdd onAdd={addWaypoint} />}

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
