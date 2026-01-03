import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { apiGet, apiPost, apiPostForm } from "../../api";

type ChatSender = { id: string; name?: string | null; email?: string | null; login?: string | null };
type ChatMsg = {
    id: string;
    tripId: string;
    senderId: string;
    text?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileMime?: string | null;
    createdAt: string;
    sender: ChatSender;
    mentions?: { userId: string }[];
};

export function TripChat({ tripId }: { tripId: string }) {
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [text, setText] = useState("");
    const [file, setFile] = useState<File | null>(null);

    const [search, setSearch] = useState("");
    const [searchRes, setSearchRes] = useState<ChatMsg[]>([]);
    const [unread, setUnread] = useState<number>(0);

    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
    const bottomRef = useRef<HTMLDivElement | null>(null);

    const token = useMemo(() => localStorage.getItem("token"), []);
    const socketRef = useRef<Socket | null>(null);

    function scrollToBottom() {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }

    async function loadUnread() {
        try {
            const r = await apiGet<{ unread: number }>(`/trips/${tripId}/chat/unread-count`);
            setUnread(r.unread);
        } catch {}
    }

    async function loadHistory() {
        try {
            const r = await apiGet<ChatMsg[]>(`/trips/${tripId}/chat`);
            setMessages(r);
            scrollToBottom();
            await apiPost(`/trips/${tripId}/chat/read`, {}); // mark read on open
            await loadUnread();
        } catch {}
    }

    useEffect(() => {
        loadHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tripId]);

    useEffect(() => {
        if (!token) return;

        const s = io(import.meta.env.VITE_API_URL + "/chat", {
            auth: { token },
            transports: ["websocket"],
        });

        socketRef.current = s;

        s.on("connect", () => {
            s.emit("joinTrip", { tripId });
        });

        s.on("history", (data: ChatMsg[]) => {
            setMessages(data);
            scrollToBottom();
        });

        s.on("newMessage", async (msg: ChatMsg) => {
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();

            // якщо повідомлення не від мене — збільшимо unread локально (і підтягнемо з сервера)
            await loadUnread();
        });

        s.on("typing", (p: { userId: string; isTyping: boolean }) => {
            setTypingUsers((prev) => ({ ...prev, [p.userId]: p.isTyping }));
            // авто-гасимо через 2.5 сек
            setTimeout(() => {
                setTypingUsers((prev) => ({ ...prev, [p.userId]: false }));
            }, 2500);
        });

        s.on("read", async () => {
            await loadUnread();
        });

        return () => {
            s.disconnect();
            socketRef.current = null;
        };
    }, [token, tripId]);

    // typing сигнал
    useEffect(() => {
        const s = socketRef.current;
        if (!s) return;

        const t = setTimeout(() => {
            s.emit("typing", { tripId, isTyping: text.trim().length > 0 });
        }, 300);

        return () => clearTimeout(t);
    }, [text, tripId]);

    async function doSearch() {
        const q = search.trim();
        if (!q) {
            setSearchRes([]);
            return;
        }
        const r = await apiGet<ChatMsg[]>(`/trips/${tripId}/chat/search?q=${encodeURIComponent(q)}`);
        setSearchRes(r);
    }

    // very simple mentions: якщо є @слово — спробуємо знайти учасника бекендом на наступних етапах
    // тут MVP: просто відправляємо текст, а mentions (userId[]) додамо коли буде список учасників
    async function send() {
        if (!text.trim() && !file) return;

        let dto: any = { text: text.trim() || undefined };

        if (file) {
            const form = new FormData();
            form.append("file", file);
            const up = await apiPostForm<{ fileUrl: string; fileName: string; fileMime: string }>(
                `/trips/${tripId}/chat/upload`,
                form
            );

            dto.fileUrl = up.fileUrl;
            dto.fileName = up.fileName;
            dto.fileMime = up.fileMime;
        }

        // відправка через WS (якщо є)
        const s = socketRef.current;
        if (s && s.connected) {
            s.emit("sendMessage", { tripId, dto });
        } else {
            await apiPost(`/trips/${tripId}/chat/message`, dto);
        }

        setText("");
        setFile(null);

        await apiPost(`/trips/${tripId}/chat/read`, {});
        await loadUnread();
    }

    const typingList = Object.entries(typingUsers)
        .filter(([, v]) => v)
        .map(([id]) => id);

    const showList = searchRes.length ? searchRes : messages;

    return (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <b>Чат</b>
                <span style={{ opacity: 0.7 }}>Непрочитані: {unread}</span>

                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Пошук по повідомленнях…"
                        style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", width: 240 }}
                    />
                    <button onClick={doSearch}>Пошук</button>
                    <button
                        onClick={() => {
                            setSearch("");
                            setSearchRes([]);
                        }}
                    >
                        Очистити
                    </button>
                </div>
            </div>

            {typingList.length > 0 && (
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
                    Хтось друкує…
                </div>
            )}

            <div style={{ height: 380, overflowY: "auto", padding: 8, background: "#fafafa", borderRadius: 12 }}>
                {showList.map((m) => (
                    <div key={m.id} style={{ padding: 8, marginBottom: 8, background: "white", borderRadius: 10 }}>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                            <b>{m.sender?.name || m.sender?.login || m.sender?.email || "Учасник"}</b>{" "}
                            · {new Date(m.createdAt).toLocaleString()}
                        </div>

                        {m.text && <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{m.text}</div>}

                        {m.fileUrl && (
                            <div style={{ marginTop: 8 }}>
                                <a href={import.meta.env.VITE_API_URL + m.fileUrl} target="_blank" rel="noreferrer">
                                    📎 {m.fileName || "Файл"}
                                </a>
                                {m.fileMime?.startsWith("image/") && (
                                    <div style={{ marginTop: 8 }}>
                                        <img
                                            src={import.meta.env.VITE_API_URL + m.fileUrl}
                                            alt="attachment"
                                            style={{ maxWidth: 240, borderRadius: 10 }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Напишіть повідомлення…"
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                        }
                    }}
                />

                <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    style={{ width: 240 }}
                />

                <button onClick={send} style={{ padding: "10px 14px" }}>
                    Надіслати
                </button>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Enter — надіслати · Shift+Enter — новий рядок · Файли до 50MB
            </div>
        </div>
    );
}
