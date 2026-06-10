import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Image,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const ICONS = {
  pig:  require("../assets/icons/pig.png"),
  user: require("../assets/icons/user.png"),
  lock: require("../assets/icons/lock.png"), 
};

export default function LoginScreen({ onRegister }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors,   setErrors]   = useState({});
  const passwordRef = useRef(null);


  function validate() {
    const e = {};
    if (!username.trim()) e.username = "Username is required.";
    if (!password.trim()) e.password = "Password is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
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
      Alert.alert("Sign In Failed", e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={s.screen}
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
            <Image source={ICONS.pig} style={s.logoImg} />
          </View>
          <Text style={s.appName}>Piglytics</Text>
          <Text style={s.tagline}>Smart Farming, Happy Herd</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Welcome back!</Text>
          <Text style={s.cardSubtitle}>Sign in to manage your farm</Text>

          {/* Username */}
          <View style={s.field}>
            <RequiredLabel label="Username" />
            <View style={[s.inputWrap, errors.username && s.inputWrapError]}>
              <Image source={ICONS.user} style={s.inputIcon} />
              <TextInput
                style={s.input}
                value={username}
                onChangeText={v => { setUsername(v); if (errors.username) setErrors(p => ({ ...p, username: null })); }}
                placeholder="Enter your username"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>
            {errors.username ? <Text style={s.errorText}>{errors.username}</Text> : null}
          </View>

          {/* Password */}
          <View style={s.field}>
            <RequiredLabel label="Password" />
            <View style={[s.inputWrap, errors.password && s.inputWrapError]}>
              <Image source={ICONS.lock} style={s.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={s.input}
                value={password}
                onChangeText={v => { setPassword(v); if (errors.password) setErrors(p => ({ ...p, password: null })); }}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Text style={s.showPass}>{showPass ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}
          </View>

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

          <View style={s.divider}>
            <View style={s.divLine} />
            <Text style={s.divText}>or</Text>
            <View style={s.divLine} />
          </View>

          {onRegister && (
            <TouchableOpacity style={s.registerBtn} onPress={onRegister}>
              <Text style={s.registerBtnText}>Create new account</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={s.bottomText}>Concepcion Pinagbakuran Piggery</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RequiredLabel({ label }) {
  return (
    <Text style={s.fieldLabel}>
      {label}<Text style={s.asterisk}> *</Text>
    </Text>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.primary },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  hero:     { alignItems: "center", paddingTop: 60, paddingBottom: 28 },
  logoWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  logoImg:  { width: 52, height: 52, resizeMode: "contain" },
  appName:  { fontSize: 34, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  tagline:  { fontSize: 14, color: "rgba(255,255,255,0.75)", marginTop: 4 },

  card:         { marginHorizontal: 20, backgroundColor: COLORS.white, borderRadius: RADIUS.xxl, padding: 24, ...SHADOW.lg },
  cardTitle:    { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 24 },

  field:          { marginBottom: 16 },
  fieldLabel:     { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  asterisk:       { color: "#E53935", fontWeight: "800" },
  inputWrap:      { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  inputWrapError: { borderColor: "#E53935", borderWidth: 1.5 },
  inputIcon:      { width: 18, height: 18, resizeMode: "contain", opacity: 0.5 },
  input:          { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 12 },
  showPass:       { fontSize: 12, color: COLORS.primary, fontWeight: "600" },
  errorText:      { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },

  loginBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 16, alignItems: "center", marginTop: 8 },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  divider:  { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 16 },
  divLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },
  divText:  { fontSize: 12, color: COLORS.textMuted },

  registerBtn:     { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.xl, padding: 14, alignItems: "center" },
  registerBtnText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },

  bottomText: { textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 12, marginTop: 28 },
});