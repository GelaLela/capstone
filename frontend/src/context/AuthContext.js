import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, getBaseUrl } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,    setToken]    = useState(null);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [farmId,   setFarmId]   = useState(null);
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    console.log("[Piglytics] APP START — reading AsyncStorage");

    (async () => {
      try {
        const [t, a, f, u] = await Promise.all([
          AsyncStorage.getItem("authToken"),
          AsyncStorage.getItem("isAdmin"),
          AsyncStorage.getItem("farmId"),
          AsyncStorage.getItem("username"),
        ]);

        console.log("[Piglytics] TOKEN FOUND:", t ? "YES" : "NO");

        if (!t) {
          console.log("[Piglytics] NO TOKEN — showing Login");
          setChecking(false);
          return;
        }

        // ── Validate token against backend ────────────────────────────────
        // Uses AbortController to enforce an 8-second timeout.
        // PythonAnywhere free tier can take 15–30s on cold start.
        // fetch() with no timeout hangs indefinitely in Android APK release mode,
        // which appears as "Loading Piglytics..." frozen forever.
        console.log("[Piglytics] VALIDATING TOKEN —", getBaseUrl());
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => {
          controller.abort();
          console.log("[Piglytics] TOKEN VALIDATION TIMED OUT — restoring session optimistically");
        }, 8000);

        try {
          const res = await fetch(`${getBaseUrl()}/auth/me/`, {
            headers: {
              Authorization:  `Token ${t}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            console.log("[Piglytics] TOKEN VALID — Dashboard");
            setToken(t);
            setIsAdmin(a === "true");
            setFarmId(f ? parseInt(f) : null);
            setUsername(u || "");
          } else {
            console.log("[Piglytics] TOKEN REJECTED (", res.status, ") — Login");
            await AsyncStorage.multiRemove(["authToken", "isAdmin", "farmId", "username"]);
          }
        } catch (networkErr) {
          clearTimeout(timeoutId);
          // AbortError = timeout. Any other error = server unreachable.
          // Restore session optimistically — the dashboard will surface 401s
          // if the token is actually expired.
          const reason = networkErr.name === "AbortError"
            ? "timeout after 8s"
            : networkErr.message;
          console.log("[Piglytics] TOKEN VALIDATION FAILED (", reason, ") — restoring optimistically");
          setToken(t);
          setIsAdmin(a === "true");
          setFarmId(f ? parseInt(f) : null);
          setUsername(u || "");
        }

      } catch (e) {
        console.error("[Piglytics] AsyncStorage error:", e);
      } finally {
        // This ALWAYS runs — the spinner always dismisses.
        setChecking(false);
        console.log("[Piglytics] CHECKING DONE");
      }
    })();
  }, []);

  async function login({ token, farm_id, is_admin, username: uname }) {
    await AsyncStorage.setItem("authToken", token);
    await AsyncStorage.setItem("isAdmin",   String(Boolean(is_admin)));
    await AsyncStorage.setItem("username",  uname || "");
    if (farm_id) await AsyncStorage.setItem("farmId", String(farm_id));
    setToken(token);
    setIsAdmin(Boolean(is_admin));
    setFarmId(farm_id || null);
    setUsername(uname || "");
    console.log("[Piglytics] LOGGED IN");
  }

  async function logout() {
    console.log("[Piglytics] LOGOUT");
    try { await api.logout(); } catch (_) {}
    await AsyncStorage.multiRemove(["authToken", "isAdmin", "farmId", "username"]);
    setToken(null);
    setIsAdmin(false);
    setFarmId(null);
    setUsername("");
  }

  return (
    <AuthContext.Provider value={{ token, isAdmin, farmId, username, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be called inside <AuthProvider>");
  return ctx;
}