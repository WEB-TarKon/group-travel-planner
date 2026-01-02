import { getToken } from "./authStorage";

const API_BASE = "http://localhost:3000";

async function parseError(res: Response): Promise<string> {
    // пробуємо json
    try {
        const data = await res.json();
        const msg = data?.message;

        if (res.status === 401) return "Невірний email або пароль.";
        if (typeof msg === "string") return msg;
        if (Array.isArray(msg)) return msg.join(", ");

        return `Помилка ${res.status}`;
    } catch {
        if (res.status === 401) return "Невірний email або пароль.";
        return `Помилка ${res.status}`;
    }
}

export async function apiGet<T>(path: string): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<T>;
}

export async function apiDelete<T>(path: string): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<T>;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
    const token = getToken();

    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Помилка ${res.status}`);
    }

    // інколи бекенд може повернути пусто
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
        return (await res.text()) as unknown as T;
    }

    return (await res.json()) as T;
}

export async function apiGetBlob(url: string): Promise<Blob> {
    const token = localStorage.getItem("token");

    const r = await fetch(`${API_BASE}${url}`, {
        method: "GET",
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `HTTP ${r.status}`);
    }

    return await r.blob();
}