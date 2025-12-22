const KEY = "accessToken";

export function getToken(): string | null {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
}

export function setToken(token: string, remember: boolean) {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);

    if (remember) localStorage.setItem(KEY, token);
    else sessionStorage.setItem(KEY, token);
}

export function clearToken() {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
}
