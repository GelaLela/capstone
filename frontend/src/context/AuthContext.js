/**
 * frontend/src/context/AuthContext.js
 *
 * Single source of truth for authentication.
 * Any screen calls useAuth().logout() directly — no route params, no prop drilling.
 * App.js watches `token` from this context and re-routes when it becomes null.
 */
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,    setToken]    = useState(null);
  const [isAdmin,  setIsAdmin]  = useState(false);
  const [farmId,   setFarmId]   = useState(null);
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(true); // true while reading AsyncStorage

  // ── Restore session from storage on cold start ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [t, a, f, u] = await Promise.all([
          AsyncStorage.getItem("authToken"),
          AsyncStorage.getItem("isAdmin"),
          AsyncStorage.getItem("farmId"),
          AsyncStorage.getItem("username"),
        ]);
        if (t) {
          setToken(t);
          setIsAdmin(a === "true");
          setFarmId(f ? parseInt(f) : null);
          setUsername(u || "");
        }
      } catch (e) {
        console.error("AuthContext restore error:", e);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  // ── Called immediately after a successful login or register API call ───────
  async function login({ token, farm_id, is_admin, username: uname }) {
    await AsyncStorage.setItem("authToken", token);
    await AsyncStorage.setItem("isAdmin",   String(Boolean(is_admin)));
    await AsyncStorage.setItem("username",  uname || "");
    if (farm_id) await AsyncStorage.setItem("farmId", String(farm_id));

    setToken(token);
    setIsAdmin(Boolean(is_admin));
    setFarmId(farm_id || null);
    setUsername(uname || "");
  }

  // ── Clears everything and returns to LoginScreen ──────────────────────────
  // App.js sees token become null and immediately renders LoginScreen.
  // NavigationContainer key={token} ensures the entire nav tree is destroyed
  // so the user cannot press Back to return to any protected screen.
  async function logout() {
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

// Call this inside any screen: const { logout, isAdmin } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be called inside <AuthProvider>");
  return ctx;
}