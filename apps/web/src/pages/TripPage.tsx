import {MapContainer, Marker, Popup, TileLayer, useMapEvents, Polyline} from "react-leaflet";
import {useNavigate, useParams} from "react-router-dom";
import {apiDelete, apiGet, apiPost, apiPostForm} from "../api";
import {useEffect, useMemo, useRef, useState} from "react";
import type {Map as LeafletMap} from "leaflet";
import {useMe} from "../useMe";

type Waypoint = { order: number; lat: number; lng: number; title?: string };
type Trip = { id: string; title: string; organizerId: string; waypoints?: Waypoint[] };

type FinanceView = {
    finance: {
        baseAmountUah: number;
        depositUah: number;
        payDeadlineUser: string;
        payDeadlineOrganizer: string;
    } | null;

    organizerBankLink: string | null;

    myPayment: {
        amountUah: number;
        status: "PENDING" | "REPORTED" | "CONFIRMED" | "REJECTED";
        removedAt?: string | null;
    } | null;

    payments?: any[];
};

{/*type EnforceDeadlineResponse = {
    ok: boolean;
    removed: number;
    message?: string;
};*/
}

type MemberView = {
    user: { id: string; name: string | null; email: string };
    role: string;
    status: string;
    payment: { status: string; amountUah: number } | null;
};

function ClickToAdd({onAdd}: { onAdd: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onAdd(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
        const r = await fetch(url, {
            headers: {
                "Accept": "application/json",
            },
        });
        const j = await r.json();
        const name =
            j?.display_name ||
            `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        return name;
    } catch {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

function DraggableMarker({
                             waypoint,
                             canDrag,
                             onMoved,
                         }: {
    waypoint: Waypoint;
    canDrag: boolean;
    onMoved: (order: number, lat: number, lng: number) => void;
}) {
    return (
        <Marker
            position={[waypoint.lat, waypoint.lng]}
            draggable={canDrag}
            eventHandlers={{
                dragend: (e) => {
                    const m = e.target as any;
                    const p = m.getLatLng();
                    onMoved(waypoint.order, p.lat, p.lng); // ✅ ВАЖЛИВО: order
                },
            }}
        >
            <Popup>{waypoint.title}</Popup>
        </Marker>
    );
}


export default function TripPage() {
    const navigate = useNavigate();
    const {id} = useParams();
    const tripId = id ?? "";

    const me = useMe();

    const [trip, setTrip] = useState<Trip | null>(null);
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [routeLocked, setRouteLocked] = useState(false);
    const [requests, setRequests] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [noAccess, setNoAccess] = useState(false);
    const [financeView, setFinanceView] = useState<FinanceView | null>(null);

    const [baseAmountUah, setBaseAmountUah] = useState(1500);
    const [depositUah, setDepositUah] = useState<string>("0");
    const [payDeadline, setPayDeadline] = useState("");

    const [payNote, setPayNote] = useState("");
    const [payFile, setPayFile] = useState<File | null>(null);
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);

    const [members, setMembers] = useState<MemberView[]>([]);

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
        if (!tripId) return;

        (async () => {
            const data = await apiGet<Trip>(`/trips/${tripId}`);
            setTrip(data);
            setWaypoints(data.waypoints ?? []);

            const wps = data.waypoints ?? [];
            setWaypoints(wps);
            setRouteLocked(wps.length >= 2);

            await loadMembers();
            await loadFinance();
            if (canEditRoute) {
                await loadPending();
            } else {
                setPendingPayments([]);
            }
        })().catch(console.error);
    }, [tripId]);

    useEffect(() => {
        const t = setTimeout(() => {
            mapRef.current?.invalidateSize();
        }, 0);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (!payDeadline) {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            const pad = (n: number) => String(n).padStart(2, "0");
            setPayDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
        }
    }, []);

    useEffect(() => {
        if (!tripId) return;
        if (!canEditRoute) return;

        // одразу підтягуємо pending
        loadPending().catch(() => {});

        // далі — автоматично кожні 5 секунд
        const t = setInterval(() => {
            loadPending().catch(() => {});
        }, 5000);

        return () => clearInterval(t);
    }, [tripId, canEditRoute]);

    async function loadPending() {
        if (!id) return;
        try {
            const p = await apiGet<any[]>(`/trips/${id}/payments/pending`);
            setPendingPayments(p);
        } catch {
            // якщо не організатор — просто ігноруємо
        }
    }

    async function reportPaymentWithFile() {
        if (!id) return;

        if (!payFile) {
            setError("Додайте файл (скрін/чек) перед відправкою.");
            return;
        }

        setError(null);

        const form = new FormData();
        form.append("file", payFile);
        if (payNote.trim()) form.append("note", payNote.trim());

        try {
            await apiPostForm(`/trips/${id}/payments/report`, form);
            alert("Оплату відправлено на перевірку ✅");

            setPayFile(null);
            setPayNote("");

            // оновлюємо дані (без load())
            await loadFinance();
            await loadMembers();
            await loadPending();
        } catch (e: any) {
            setError(e?.message || "Не вдалося відправити оплату");
        }
    }

    async function moveWaypoint(order: number, lat: number, lng: number) {
        if (!canEditRoute) return;

        if (routeLocked && (order === 0 || order === waypoints.length - 1)) {
            setError("Початкову та кінцеву точки змінювати не можна");
            return;
        }

        const title = await reverseGeocode(lat, lng);

        setWaypoints((prev) =>
            prev.map((w) => (w.order === order ? {...w, lat, lng, title} : w))
        );
    }

    async function addWaypoint(lat: number, lng: number) {
        if (!canEditRoute) return;

        const title = await reverseGeocode(lat, lng);

        if (!routeLocked) {
            const next: Waypoint = {order: waypoints.length, lat, lng, title};
            setWaypoints([...waypoints, next]);
            return;
        }

        if (waypoints.length < 2) {
            const next: Waypoint = {order: waypoints.length, lat, lng, title};
            setWaypoints([...waypoints, next]);
            return;
        }

        const insertIndex = waypoints.length - 1;

        const next: Waypoint = {order: insertIndex, lat, lng, title};

        const newList = [
            ...waypoints.slice(0, insertIndex),
            next,
            ...waypoints.slice(insertIndex),
        ].map((w, idx) => ({...w, order: idx}));

        setWaypoints(newList);
    }

    function removeWaypoint(order: number) {
        if (!canEditRoute) return;

        if (routeLocked && (order === 0 || order === waypoints.length - 1)) return;

        const filtered = waypoints.filter((w) => w.order !== order);

        const reindexed = filtered.map((w, idx) => ({
            ...w,
            order: idx,
        }));

        setWaypoints(reindexed);
    }

    function roleUa(role: string) {
        if (role === "ORGANIZER") return "Організатор";
        if (role === "PARTICIPANT") return "Учасник";
        return role;
    }

    function paymentStatusUa(s: string) {
        if (s === "PENDING") return "Очікує";
        if (s === "REPORTED") return "Відмічено користувачем";
        if (s === "CONFIRMED") return "Підтверджено";
        if (s === "REJECTED") return "Відхилено";
        return s;
    }

    async function save() {
        if (!canEditRoute) return;
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/waypoints`, {waypoints});
            alert("Збережено");
            setRouteLocked(waypoints.length >= 2);
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

    async function loadMembers() {
        try {
            setNoAccess(false);
            const data = await apiGet<MemberView[]>(`/trips/${tripId}/members`);
            setMembers(data);
        } catch (e: any) {
            const msg = String(e);
            if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
                setNoAccess(true);
                setMembers([]);
                setError("Ви не маєте доступу до цієї подорожі (можливо вас видалили).");
                navigate("/", {replace: true});
                return;
            }

            setError(msg);
        }
    }

    async function approve(requestId: string) {
        setError(null);
        try {
            await apiPost(`/trips/${tripId}/join-requests/${requestId}/approve`, {});
            await loadRequests();
            await loadMembers();
            await loadFinance();
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
            await loadMembers();
            await loadFinance();
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
            navigate("/", {replace: true});
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
                setDepositUah(String(data.finance.depositUah ?? 0));

                const iso = data.finance.payDeadlineUser;
                const d = new Date(iso);
                const pad = (n: number) => String(n).padStart(2, "0");
                const localValue = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                setPayDeadline(localValue);
            }
        } catch {
            setFinanceView({finance: null, organizerBankLink: null, myPayment: null});
        }
    }

    async function saveFinance() {
        if (!canEditRoute) return;

        const dep = depositUah === "" ? 0 : Number(depositUah);

        if (!Number.isFinite(dep) || dep < 0) {
            setError("Гарантійний внесок має бути 0 або більше.");
            return;
        }

        const iso = new Date(payDeadline).toISOString();

        await apiPost(`/trips/${tripId}/finance`, {
            baseAmountUah: Number(baseAmountUah),
            depositUah: dep,
            payDeadline: iso,
        });

        alert("Фінанси збережено");
        await loadFinance();
        await loadMembers();
    }

    if (!trip) return <div style={{padding: 16}}>Завантаження…</div>;

    return (
        <div style={{position: "fixed", inset: 0, display: "flex"}}>
            <div
                style={{
                    width: 340,
                    padding: 16,
                    overflow: "auto",
                    borderRight: "1px solid #ddd",
                }}
            >
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8}}>
                    <h3 style={{margin: 0}}>{trip.title}</h3>

                    <button onClick={() => navigate("/")} style={{height: 32}}>
                        ← Назад
                    </button>
                </div>

                {error && <div style={{color: "crimson", marginTop: 10}}>{error}</div>}

                {noAccess && (
                    <div style={{color: "crimson", marginTop: 10}}>
                        Ви не маєте доступу до цієї подорожі (можливо вас видалили зі списку).
                    </div>
                )}

                <div style={{marginTop: 12}}>
                    {canEditRoute ? (
                        <p>Клікни на карту — додаси точку маршруту.</p>
                    ) : (
                        <p style={{opacity: 0.8}}>Маршрут може редагувати тільки організатор.</p>
                    )}

                    {canEditRoute && (
                        <>
                            <button onClick={save} style={{marginBottom: 10, display: "block", width: "100%"}}>
                                Зберегти точки
                            </button>

                            <button
                                onClick={() => {
                                    if (waypoints.length <= 2) {
                                        setWaypoints(waypoints); // нічого
                                        return;
                                    }
                                    const kept = [waypoints[0], waypoints[waypoints.length - 1]].map((w, idx) => ({
                                        ...w,
                                        order: idx
                                    }));
                                    setWaypoints(kept);
                                }}
                                style={{marginBottom: 10, display: "block", width: "100%"}}
                            >
                                Очистити маршрут
                            </button>

                            <button
                                onClick={deleteTrip}
                                style={{marginBottom: 14, display: "block", width: "100%"}}
                            >
                                Видалити подорож
                            </button>
                        </>
                    )}
                </div>

                <h4 style={{margin: "10px 0"}}>Точки</h4>
                <ol>
                    {waypoints.map((w) => (
                        <li key={w.order}>
                            {w.title ?? `Точка ${w.order + 1}`}
                            {canEditRoute && (!routeLocked || (w.order !== 0 && w.order !== waypoints.length - 1)) && (
                                <button onClick={() => removeWaypoint(w.order)} style={{marginLeft: 8}}>
                                    Видалити
                                </button>
                            )}
                        </li>
                    ))}
                </ol>

                <hr style={{margin: "12px 0"}}/>
                <h4>Учасники</h4>

                {members.length === 0 ? (
                    <div style={{opacity: 0.7}}>Поки що немає учасників…</div>
                ) : (
                    <ul style={{paddingLeft: 16}}>
                        {members.map((m) => {
                            const label = m.user.name || m.user.email;
                            return (
                                <li key={m.user.id} style={{marginBottom: 6}}>
                                    {label} — <b>{roleUa(m.role)}</b>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {canEditRoute && (
                    <section style={{border: "1px solid #ddd", borderRadius: 8, padding: 12}}>
                        <h3 style={{marginTop: 0}}>Оплати на перевірку</h3>
                        <button onClick={loadPending}>Оновити</button>
                        {pendingPayments.length === 0 && <div style={{opacity: 0.75}}>Немає оплат на перевірку</div>}

                        <ul>
                            {pendingPayments.map((p) => (
                                <li key={p.id} style={{marginBottom: 10}}>
                                    <div>
                                        <b>{p.user?.name || p.user?.email || p.userId}</b>
                                    </div>
                                    {p.note && <div style={{opacity: 0.8}}>Коментар: {p.note}</div>}
                                    {p.proofUrl && (
                                        <div>
                                            <a href={`http://localhost:3000${p.proofUrl}`} target="_blank"
                                               rel="noreferrer">
                                                Відкрити файл: {p.proofName || p.proofUrl}
                                            </a>
                                        </div>
                                    )}

                                    <div style={{marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap"}}>
                                        <button
                                            onClick={async () => {
                                                await apiPost(`/trips/${id}/payments/${p.userId}/confirm`, {});
                                                await loadFinance();
                                                await loadMembers();
                                                await loadPending();
                                            }}
                                        >
                                            Підтвердити
                                        </button>

                                        <button
                                            onClick={async () => {
                                                const reason = prompt("Причина відхилення (необов’язково)") || "";
                                                await apiPost(`/trips/${id}/payments/${p.userId}/reject`, {reason});
                                                await loadFinance();
                                                await loadMembers();
                                                await loadPending();
                                            }}
                                        >
                                            Відхилити
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <hr style={{margin: "12px 0"}}/>
                <h4>Оплата / фінанси</h4>

                {!financeView || !financeView.finance ? (
                    <div style={{opacity: 0.95}}>
                        <p style={{opacity: 0.8}}>Фінанси ще не налаштовано.</p>

                        {canEditRoute ? (
                            <div style={{display: "grid", gap: 8}}>
                                <label>
                                    Базова сума (грн)
                                    <input
                                        type="number"
                                        value={baseAmountUah}
                                        onChange={(e) => setBaseAmountUah(Number(e.target.value))}
                                        style={{width: "100%"}}
                                    />
                                </label>

                                <label>
                                    Гарантійний внесок (грн)
                                    <input
                                        inputMode="numeric"
                                        value={depositUah}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (v === "") return setDepositUah("");
                                            if (!/^\d+$/.test(v)) return;
                                            setDepositUah(v);
                                        }}
                                        style={{width: "100%"}}
                                    />
                                </label>

                                <label>
                                    Дедлайн для учасників
                                    <input
                                        type="datetime-local"
                                        value={payDeadline}
                                        onChange={(e) => setPayDeadline(e.target.value)}
                                        style={{width: "100%"}}
                                    />
                                </label>

                                <div style={{fontSize: 12, opacity: 0.8}}>
                                    Дедлайн для організатора (перевірка) буде автоматично:{" "}
                                    <b>
                                        {payDeadline
                                            ? new Date(new Date(payDeadline).getTime() + 30 * 60 * 1000).toLocaleString()
                                            : "—"}
                                    </b>
                                </div>

                                <button onClick={saveFinance}>Зберегти фінанси</button>
                            </div>
                        ) : (
                            <div style={{opacity: 0.8}}>
                                Фінанси ще не налаштовано організатором.
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{display: "grid", gap: 8}}>
                        <div>Базова сума: <b>{financeView.finance.baseAmountUah} грн</b></div>
                        <div>Внесок: <b>{financeView.finance.depositUah} грн</b></div>

                        {canEditRoute ? (
                            <>
                                <div>
                                    Дедлайн для учасників:{" "}
                                    <b>{new Date(financeView.finance.payDeadlineUser).toLocaleString()}</b>
                                </div>
                                <div>
                                    Дедлайн для організатора (перевірка):{" "}
                                    <b>{new Date(financeView.finance.payDeadlineOrganizer).toLocaleString()}</b>
                                </div>
                            </>
                        ) : (
                            <div>
                                ДЕДЛАЙН ОПЛАТИ:{" "}
                                <b>{new Date(financeView.finance.payDeadlineUser).toLocaleString()}</b>
                            </div>
                        )}

                        <div style={{marginTop: 6}}>
                            Куди платити:{" "}
                            {financeView.organizerBankLink ? (
                                <a href={financeView.organizerBankLink} target="_blank" rel="noreferrer">
                                    банківське посилання організатора
                                </a>
                            ) : (
                                <span style={{opacity: 0.7}}>організатор ще не вказав посилання</span>
                            )}
                        </div>

                        <div>
                            Мій статус: <b>{paymentStatusUa(financeView.myPayment?.status ?? "PENDING")}</b>
                        </div>

                        {financeView.myPayment?.status === "REPORTED" && (
                            <div style={{opacity: 0.8}}>Очікує підтвердження організатором…</div>
                        )}

                        {financeView.myPayment?.status === "CONFIRMED" && (
                            <div>Оплату підтверджено</div>
                        )}

                        {canEditRoute && (
                            <>
                                <div style={{marginTop: 8, display: "grid", gap: 8}}>
                                    <label>
                                        Базова сума (грн)
                                        <input
                                            type="number"
                                            value={baseAmountUah}
                                            onChange={(e) => setBaseAmountUah(Number(e.target.value))}
                                            style={{width: "100%"}}
                                        />
                                    </label>

                                    <label>
                                        Гарантійний внесок (грн)
                                        <input
                                            inputMode="numeric"
                                            value={depositUah}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                // дозволяємо "" (щоб стерти)
                                                if (v === "") return setDepositUah("");
                                                // тільки цифри
                                                if (!/^\d+$/.test(v)) return;
                                                setDepositUah(v);
                                            }}
                                            style={{width: "100%"}}
                                        />

                                    </label>

                                    <label>
                                        Дедлайн оплати
                                        <input
                                            type="datetime-local"
                                            value={payDeadline}
                                            onChange={(e) => setPayDeadline(e.target.value)}
                                            style={{width: "100%"}}
                                        />
                                    </label>

                                    <button onClick={saveFinance}>Оновити фінанси</button>

                                    {/*<button
                                        onClick={async () => {
                                            try {
                                                const res = await apiPost<EnforceDeadlineResponse>(
                                                    `/trips/${tripId}/finance/enforce-deadline`,
                                                    {}
                                                );

                                                alert(`Готово! Видалено учасників: ${res.removed}`);
                                                await loadFinance();
                                                await loadMembers();
                                            } catch (e) {
                                                alert("Помилка при перевірці дедлайну");
                                                console.error(e);
                                            }
                                        }}
                                        style={{ marginTop: 8 }}
                                    >
                                        Перевірити дедлайн оплати
                                    </button> */}
                                </div>

                                <div style={{marginTop: 12}}>
                                    <b>Платежі учасників</b>
                                    <ul>
                                        {(financeView.payments ?? []).map((p: any) => {
                                            const label = p.user?.name || p.user?.email || p.userId;

                                            return (
                                                <li key={p.userId} style={{marginTop: 6}}>
                                                    {label}: <b>{paymentStatusUa(p.status)}</b>
                                                    {p.status === "REPORTED" && (
                                                        <span style={{marginLeft: 6, opacity: 0.8}}>
    (перевіряється у блоці “Оплати на перевірку”)
  </span>
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

                {!canEditRoute && (
                    <section style={{border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 12}}>
                        <h3 style={{marginTop: 0}}>Оплата</h3>

                        {financeView?.myPayment?.status === "CONFIRMED" && (
                            <div><b>Оплачено ✅</b></div>
                        )}

                        {financeView?.myPayment?.status === "REPORTED" && (
                            <div style={{opacity: 0.85}}>Оплата на перевірці у організатора…</div>
                        )}

                        {(financeView?.myPayment?.status === "PENDING" ||
                            financeView?.myPayment?.status === "REJECTED" ||
                            !financeView?.myPayment) && (
                            <div style={{display: "grid", gap: 10, maxWidth: 520}}>
                                <div>
                                    <label>Коментар (необов’язково)</label>
                                    <input
                                        value={payNote}
                                        onChange={(e) => setPayNote(e.target.value)}
                                        style={{width: "100%"}}
                                    />
                                </div>

                                <div>
                                    <label>Файл чеку/скріну (png/jpg/pdf)</label>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={(e) => setPayFile(e.target.files?.[0] || null)}
                                    />
                                </div>

                                <button onClick={reportPaymentWithFile}>Я оплатив — відправити на перевірку</button>

                                {financeView?.myPayment?.status === "REJECTED" && (
                                    <div style={{color: "crimson"}}>
                                        Оплату відхилено.
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </div>

            <div style={{flex: 1, minWidth: 0}}>
                <MapContainer center={center} zoom={12} style={{height: "100%", width: "100%"}} ref={mapRef}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; OpenStreetMap contributors"
                    />

                    {polylinePositions.length >= 2 && <Polyline positions={polylinePositions}/>}

                    {canEditRoute && <ClickToAdd onAdd={addWaypoint}/>}

                    {waypoints.map((w) => (
                        <DraggableMarker
                            key={w.order}
                            waypoint={w}
                            canDrag={
                                canEditRoute &&
                                (!routeLocked || (w.order !== 0 && w.order !== waypoints.length - 1))
                            }
                            onMoved={moveWaypoint}
                        />
                    ))}
                </MapContainer>
            </div>
        </div>
    );
}
