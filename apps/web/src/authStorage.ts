const LS_TOKEN = "gtp_token";
const SS_TOKEN = "gtp_token";
const LS_REMEMBER = "gtp_remember_me";

export function getRememberMe(): boolean {
    return localStorage.getItem(LS_REMEMBER) === "1";
}

export function setRememberMe(value: boolean) {
    localStorage.setItem(LS_REMEMBER, value ? "1" : "0");
}

export function setToken(token: string, remember: boolean) {
    setRememberMe(remember);

    if (remember) {
        localStorage.setItem(LS_TOKEN, token);
        sessionStorage.removeItem(SS_TOKEN);
    } else {
        sessionStorage.setItem(SS_TOKEN, token);
        localStorage.removeItem(LS_TOKEN);
    }
}

export function getToken(): string | null {
    return localStorage.getItem(LS_TOKEN) || sessionStorage.getItem(SS_TOKEN);
}

export function clearToken() {
    localStorage.removeItem(LS_TOKEN);
    sessionStorage.removeItem(SS_TOKEN);
}
