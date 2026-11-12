import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { baseAPI } from "../features/api/_baseAPI";
import { authenticateUser, deauthenticateUser, expireSession } from "../features/auth/authSlice";
import { clearSessionStorage, getTokenExpiry, hasLiveSession } from "../utils/authSession";

export default function useSessionExpiry() {
    const user = useSelector((state) => state.auth.user);
    const dispatch = useDispatch();
    const location = useLocation();

    useEffect(() => {
        if (!user) return;
        let timer;
        const check = () => {
            clearTimeout(timer);
            const token = Cookies.get("token");
            if (!hasLiveSession(token)) {
                clearSessionStorage();
                dispatch(expireSession());
                dispatch(baseAPI.util.resetApiState());
                return;
            }
            timer = setTimeout(check, Math.min(getTokenExpiry(token) - Date.now(), 2147483647));
        };
        const onVisible = () => { if (document.visibilityState === "visible") check(); };
        const onStorage = (event) => {
            if (event.key !== "auth" && event.key !== null) return;
            clearTimeout(timer);
            if (!event.newValue) {
                dispatch(hasLiveSession() ? deauthenticateUser() : expireSession());
                dispatch(baseAPI.util.resetApiState());
                return;
            }
            try {
                const saved = JSON.parse(event.newValue);
                if (saved?.user && hasLiveSession()) {
                    dispatch(authenticateUser(saved));
                    dispatch(baseAPI.util.resetApiState());
                    return;
                }
            } catch { /* Invalid stored sessions are handled by the next check. */ }
            check();
        };

        check();
        window.addEventListener("focus", check);
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("storage", onStorage);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("focus", check);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("storage", onStorage);
        };
    }, [user, dispatch, location.key]);
}
