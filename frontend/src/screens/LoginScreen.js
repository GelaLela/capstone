/**
 * frontend/src/screens/LoginScreen.js
 *
 * Issue 1 fix:
 *   The api.js request() function now throws errors with the server's actual
 *   message for 4xx errors, and "Unable to connect..." only for genuine
 *   network failures. LoginScreen no longer needs to guess the error type —
 *   it just shows whatever message comes from the API or network layer.
 */
import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function LoginScreen({ onRegister }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const passwordRef = useRef(null);

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert("Missing Information", "Please enter both your username and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      if (data?.token) {
        await login({
          token:    data.token,
          farm_id:  data.farm_id,
          is_admin: data.is_admin,
          username: data.username,
        });
      } else {
        Alert.alert("Sign In Failed", "Incorrect username or password.");
      }
    } catch (e) {
      // api.js now correctly sends the server's error message for 4xx errors
      // and "Unable to connect..." only for genuine network failures.
      // No need to inspect the message — just show it.
      Alert.alert("Sign In Failed", e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.logoWrap}>
            <Text style={{ fontSize: 48 }}>🐷</Text>
          </View>
          <Text style={s.appName}>Piglytics</Text>
          <Text style={s.tagline}>Smart Farming, Happy Herd</Text>
        </View>

        {/* Form card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome back!</Text>
          <Text style={s.cardSub}>Sign in to manage your farm</Text>

          {/* Username */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Username</Text>
            <View style={s.inputRow}>
              <Text style={s.inputIcon}>👤</Text>
              <TextInput
                style={s.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
          </View>

          {/* Password */}
          <View style={s.fieldGroup}>
            <Text style={s.label}>Password</Text>
            <View style={s.inputRow}>
              <Text style={s.inputIcon}>🔒</Text>
              <TextInput
                ref={passwordRef}
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.showHide}>{showPass ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign in button */}
          <TouchableOpacity
            style={[s.loginBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={s.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {/* Register */}
          <TouchableOpacity style={s.registerBtn} onPress={onRegister}>
            <Text style={s.registerBtnText}>Create new account →</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>🌾 Concepcion Pinagbakuran Piggery 🌾</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.primary },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  hero:    { alignItems: "center", paddingTop: 48, paddingBottom: 24 },
  logoWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  appName: { fontSize: 34, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },

  card:      { marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.xxl, padding: 24, ...SHADOW.lg },
  cardTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: COLORS.textMuted, marginBottom: 24 },

  fieldGroup: { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  inputRow:   { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  inputIcon:  { fontSize: 16 },
  input:      { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 13 },
  showHide:   { fontSize: 12, color: COLORS.primary, fontWeight: "600", paddingVertical: 13 },

  loginBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 16, alignItems: "center", marginTop: 8 },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 },
  divLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  divText: { fontSize: 12, color: COLORS.textMuted },

  registerBtn:     { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.xl, padding: 14, alignItems: "center", marginTop: 8 },
  registerBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },

  footer: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 28, marginBottom: 8 },
});