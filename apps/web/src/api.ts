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
