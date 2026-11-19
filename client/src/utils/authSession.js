import Cookies from "js-cookie";

export const SESSION_ENDED_MESSAGE = "Your session has ended. Please sign in again to continue.";

// Client decoding only schedules the UI transition. The backend validates JWTs.
export function getTokenExpiry(token) {
    try {
        if (typeof token !== "string" || token.split(".").length !== 3) return null;
        const encoded = token.split(".")[1];
        if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
        const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
        const expiry = typeof payload.exp === "number" ? payload.exp * 1000 : NaN;
        return Number.isFinite(expiry) && expiry > 0 ? expiry : null;
    } catch {
        return null;
    }
}

export function hasLiveSession(token = Cookies.get("token"), now = Date.now()) {
    const expiry = getTokenExpiry(token);
    return expiry !== null && expiry > now;
}

export function clearSessionStorage() {
    Cookies.remove("token", { path: "/" });
    Cookies.remove("accesstoken", { path: "/" });
    try { localStorage.removeItem("auth"); } catch { /* Redux still clears if storage is unavailable. */ }
}

export function getPostLoginPath(from) {
    const pathname = from?.pathname;
    if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) return "/dashboard";
    return `${pathname}${from.search || ""}${from.hash || ""}`;
}
