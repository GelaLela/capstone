/**
 * frontend/src/context/AuthContext.js
 *
 * Authentication state for the entire app.
 *
 * Startup flow:
 *   1. Read AsyncStorage for saved token
 *   2. If token found, validate it against GET /api/auth/me/
 *      - If server says 200 → restore session, go to Dashboard
 *      - If server says 401 → token expired, clear storage, go to Login
 *      - If server unreachable (offline/wrong URL) → restore session optimistically
 *        so the app still works on the local network even if pythonanywhere is down
 *   3. Set checking=false so the loading spinner disappears
 *
 * This prevents two bugs:
 *   A) "Stuck on loading" → caused by never setting checking=false
 *   B) "Skip to Dashboard" → caused by restoring stale tokens without validation
 */
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
        console.log("[Piglytics] IS_ADMIN:", a);
        console.log("[Piglytics] FARM_ID:", f);
        console.log("[Piglytics] USERNAME:", u);

        if (!t) {
          // No token stored — show Login immediately
          console.log("[Piglytics] NAVIGATING LOGIN — no token in storage");
          return;
        }

        // Token exists — validate it against the backend before trusting it
        console.log("[Piglytics] VALIDATING TOKEN against", getBaseUrl());
        try {
          const res = await fetch(`${getBaseUrl()}/auth/me/`, {
            headers: {
              Authorization: `Token ${t}`,
              "Content-Type": "application/json",
            },
          });

          if (res.ok) {
            // Token is valid — restore session
            console.log("[Piglytics] TOKEN VALID — NAVIGATING DASHBOARD");
            setToken(t);
            setIsAdmin(a === "true");
            setFarmId(f ? parseInt(f) : null);
            setUsername(u || "");
          } else {
            // Token rejected by server (401 expired/invalid)
            console.log("[Piglytics] TOKEN INVALID (status", res.status, ") — clearing storage, NAVIGATING LOGIN");
            await AsyncStorage.multiRemove(["authToken", "isAdmin", "farmId", "username"]);
            // token stays null → LoginScreen renders
          }
        } catch (networkErr) {
          // Cannot reach server — restore session optimistically.
          // This handles: device is offline, server is temporarily down,
          // or dev mode with local backend.
          // Better to show Dashboard with API errors than to force re-login
          // every time the network hiccups.
          console.log(
            "[Piglytics] WEATHER FAILED / NETWORK ERROR during validation:",
            networkErr.message,
            "— restoring session optimistically"
          );
          setToken(t);
          setIsAdmin(a === "true");
          setFarmId(f ? parseInt(f) : null);
          setUsername(u || "");
        }
      } catch (e) {
        // AsyncStorage itself failed — go to Login
        console.error("[Piglytics] AsyncStorage read error:", e);
      } finally {
        // This ALWAYS runs, even if an error occurred above.
        // Without this, checking stays true and the spinner never disappears.
        console.log("[Piglytics] SETTING CHECKING FALSE");
        setChecking(false);
      }
    })();
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────
  // Called by LoginScreen and RegisterScreen after a successful API response.
  async function login({ token, farm_id, is_admin, username: uname }) {
    console.log("[Piglytics] LOGIN — saving session to AsyncStorage");
    await AsyncStorage.setItem("authToken", token);
    await AsyncStorage.setItem("isAdmin",   String(Boolean(is_admin)));
    await AsyncStorage.setItem("username",  uname || "");
    if (farm_id) await AsyncStorage.setItem("farmId", String(farm_id));

    setToken(token);
    setIsAdmin(Boolean(is_admin));
    setFarmId(farm_id || null);
    setUsername(uname || "");
    console.log("[Piglytics] NAVIGATING DASHBOARD");
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  // Clears all state and storage. App.js sees token=null and renders LoginScreen.
  // NavigationContainer key={token} ensures the nav stack is fully destroyed
  // so Back cannot return to any protected screen.
  async function logout() {
    console.log("[Piglytics] LOGOUT — clearing session");
    try { await api.logout(); } catch (_) {}
    await AsyncStorage.multiRemove(["authToken", "isAdmin", "farmId", "username"]);
    setToken(null);
    setIsAdmin(false);
    setFarmId(null);
    setUsername("");
    console.log("[Piglytics] NAVIGATING LOGIN");
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