import { MapContainer, Marker, Popup, TileLayer, useMapEvents, Polyline } from "react-leaflet";
import { useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../api";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useMe } from "../useMe";

type Waypoint = { order: number; lat: number; lng: number; title?: string };
type Trip = { id: string; title: string; organizerId: string; waypoints?: Waypoint[] };

type FinanceView = {
    finance: {
        baseAmountUah: number;
        depositUah: number;
        payDeadline: string;
    } | null;
    organizerBankLink: string | null;
    myPayment: {
        amountUah: number;
        status: "PENDING" | "REPORTED" | "CONFIRMED" | "REJECTED";
        removedAt?: string | null;
    } | null;
    payments?: any[];
};

type EnforceDeadlineResponse = {
    ok: boolean;
    removed: number;
    message?: string;
};


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

    const [financeView, setFinanceView] = useState<FinanceView | null>(null);

    const [baseAmountUah, setBaseAmountUah] = useState(1500);
    const [depositUah, setDepositUah] = useState(0);
    const [payDeadline, setPayDeadline] = useState("");


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

    useEffect(() => {
        if (!tripId) return;
        loadFinance().catch(console.error);
    }, [tripId]);

    useEffect(() => {
        if (!payDeadline) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            const pad = (n: number) => String(n).padStart(2, "0");
            setPayDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
    }, []);

    function addWaypoint(lat: number, lng: number) {
        if (!canEditRoute) return;
        const next: Waypoint = {
            order: waypoints.length,
            lat,
            lng,
            title: `Точка ${waypoints.length + 1}`,
        };
        setWaypoints([...waypoints, next]);
    }

    function removeWaypoint(order: number) {
        if (!canEditRoute) return;
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
            setRequests([]);
        }
    }

    async function approve(requestId: string) {
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/join-requests/${requestId}/approve`, {});
            await loadRequests();
            alert("Учасника додано");
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

    async function deleteTrip() {
        if (!canEditRoute) return;

        const ok = confirm("Видалити подорож назавжди? Це також видалить точки маршруту та заявки.");
        if (!ok) return;

        setError(null);
        try {
            await apiDelete(`/trips/${tripId}`);
            alert("Подорож видалено");
            navigate("/", { replace: true });
        } catch (e) {
            setError(String(e));
        }
    }

    async function loadFinance() {
        try {
            const data = await apiGet<FinanceView>(`/trips/${tripId}/finance`);
            setFinanceView(data);

            if (data.finance) {
                setBaseAmountUah(data.finance.baseAmountUah);
                setDepositUah(data.finance.depositUah ?? 0);

                const iso = data.finance.payDeadline;
                const d = new Date(iso);
                const pad = (n: number) => String(n).padStart(2, "0");
                const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                setPayDeadline(localValue);
            }
        } catch {
            setFinanceView({ finance: null, organizerBankLink: null, myPayment: null });
        }
    }

    async function saveFinance() {
        if (!canEditRoute) return;

        const iso = new Date(payDeadline).toISOString();

        await apiPost(`/trips/${tripId}/finance`, {
            baseAmountUah: Number(baseAmountUah),
            depositUah: Number(depositUah),
            payDeadline: iso,
        });

        alert("Фінанси збережено");
        await loadFinance();
    }

    async function reportPaid() {
        await apiPost(`/trips/${tripId}/payments/report`, {});
        alert("Позначено як сплачено (очікує підтвердження)");
        await loadFinance();
    }

    async function confirmPayment(userId: string) {
        if (!canEditRoute) return;
        await apiPost(`/trips/${tripId}/payments/${userId}/confirm`, {});
        await loadFinance();
    }

    async function rejectPayment(userId: string) {
        if (!canEditRoute) return;
        await apiPost(`/trips/${tripId}/payments/${userId}/reject`, {});
        await loadFinance();
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
                            {canEditRoute && (
                                <button onClick={() => removeWaypoint(w.order)} style={{ marginLeft: 8 }}>
                                    Видалити
                                </button>
                            )}
                        </li>
                    ))}
                </ol>

                <hr style={{ margin: "12px 0" }} />
                <h4>Оплата / фінанси</h4>

                {!financeView || !financeView.finance ? (
                    <div style={{ opacity: 0.8 }}>
                        <p>Фінанси ще не налаштовано.</p>

                        {canEditRoute && (
                            <div style={{ display: "grid", gap: 8 }}>
                                <label>
                                    Базова сума (грн)
                                    <input
                                        type="number"
                                        value={baseAmountUah}
                                        onChange={(e) => setBaseAmountUah(Number(e.target.value))}
                                        style={{ width: "100%" }}
                                    />
                                </label>

                                <label>
                                    Гарантійний внесок (грн)
                                    <input
                                        type="number"
                                        value={depositUah}
                                        onChange={(e) => setDepositUah(Number(e.target.value))}
                                        style={{ width: "100%" }}
                                    />
                                </label>

                                <label>
                                    Дедлайн оплати
                                    <input
                                        type="datetime-local"
                                        value={payDeadline}
                                        onChange={(e) => setPayDeadline(e.target.value)}
                                        style={{ width: "100%" }}
                                    />
                                </label>

                                <button onClick={saveFinance}>Зберегти фінанси</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                        <div>Базова сума: <b>{financeView.finance.baseAmountUah} грн</b></div>
                        <div>Внесок: <b>{financeView.finance.depositUah} грн</b></div>
                        <div>
                            Дедлайн: <b>{new Date(financeView.finance.payDeadline).toLocaleString()}</b>
                        </div>

                        {!canEditRoute && (
                            <>
                                <div style={{ marginTop: 6 }}>
                                    Куди платити:{" "}
                                    {financeView.organizerBankLink ? (
                                        <a href={financeView.organizerBankLink} target="_blank" rel="noreferrer">
                                            банківське посилання організатора
                                        </a>
                                    ) : (
                                        <span style={{ opacity: 0.7 }}>організатор ще не вказав посилання</span>
                                    )}
                                </div>

                                <div>
                                    Мій статус: <b>{financeView.myPayment?.status ?? "PENDING"}</b>
                                </div>

                                {(financeView.myPayment?.status === "PENDING" || financeView.myPayment?.status === "REJECTED") && (
                                    <button onClick={reportPaid}>Я сплатив(ла)</button>
                                )}

                                {financeView.myPayment?.status === "REPORTED" && (
                                    <div style={{ opacity: 0.8 }}>Очікує підтвердження організатором…</div>
                                )}

                                {financeView.myPayment?.status === "CONFIRMED" && (
                                    <div>Оплату підтверджено ✅</div>
                                )}
                            </>
                        )}

                        {canEditRoute && (
                            <>
                                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                                    <label>
                                        Базова сума (грн)
                                        <input
                                            type="number"
                                            value={baseAmountUah}
                                            onChange={(e) => setBaseAmountUah(Number(e.target.value))}
                                            style={{ width: "100%" }}
                                        />
                                    </label>

                                    <label>
                                        Гарантійний внесок (грн)
                                        <input
                                            type="number"
                                            value={depositUah}
                                            onChange={(e) => setDepositUah(Number(e.target.value))}
                                            style={{ width: "100%" }}
                                        />
                                    </label>

                                    <label>
                                        Дедлайн оплати
                                        <input
                                            type="datetime-local"
                                            value={payDeadline}
                                            onChange={(e) => setPayDeadline(e.target.value)}
                                            style={{ width: "100%" }}
                                        />
                                    </label>

                                    <button onClick={saveFinance}>Оновити фінанси</button>

                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await apiPost<EnforceDeadlineResponse>(
                                                    `/trips/${tripId}/finance/enforce-deadline`,
                                                    {}
                                                );

                                                alert(`Готово! Видалено учасників: ${res.removed}`);
                                                await loadFinance();
                                            } catch (e) {
                                                alert("Помилка при перевірці дедлайну");
                                                console.error(e);
                                            }
                                        }}
                                        style={{ marginTop: 8 }}
                                    >
                                        Перевірити дедлайн оплати
                                    </button>
                                </div>

                                <div style={{ marginTop: 12 }}>
                                    <b>Платежі учасників</b>
                                    <ul>
                                        {(financeView.payments ?? []).map((p: any) => {
                                            const label = p.user?.name || p.user?.email || p.userId;

                                            return (
                                                <li key={p.userId} style={{ marginTop: 6 }}>
                                                    {label}: <b>{p.status}</b>{" "}
                                                    {p.status === "REPORTED" && (
                                                        <>
                                                            <button onClick={() => confirmPayment(p.userId)} style={{ marginLeft: 6 }}>
                                                                Підтвердити
                                                            </button>
                                                            <button onClick={() => rejectPayment(p.userId)} style={{ marginLeft: 6 }}>
                                                                Відхилити
                                                            </button>
                                                        </>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                )}

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
