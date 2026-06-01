/**
 * frontend/src/screens/RegisterScreen.js
 *
 * Issue 4 fix:
 *   Removed Owner/Worker/Solo/Group role selection entirely.
 *   Every new account is automatically a "farmer" — set on the backend.
 *   Step 2 now only collects: phone number and farm name.
 *   Farm name is always required (removed the "farm only for owners" condition
 *   since all accounts now get a farm).
 */
import React, { useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function RegisterScreen({ onBack }) {
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "", username: "", password: "", confirmPass: "",
    phone_number: "", farm_name: "",
  });
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const usernameRef = useRef();
  const passwordRef = useRef();
  const confirmRef  = useRef();
  const phoneRef    = useRef();
  const farmRef     = useRef();

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validateStep1() {
    if (!form.full_name.trim())          { Alert.alert("Required",  "Please enter your full name.");             return false; }
    if (!form.username.trim())           { Alert.alert("Required",  "Please choose a username.");                return false; }
    if (form.username.includes(" "))     { Alert.alert("Invalid",   "Username cannot contain spaces.");          return false; }
    if (!form.password)                  { Alert.alert("Required",  "Please create a password.");                return false; }
    if (form.password.length < 6)        { Alert.alert("Too Short", "Password must be at least 6 characters."); return false; }
    if (form.password !== form.confirmPass) { Alert.alert("Mismatch", "Passwords do not match.");               return false; }
    return true;
  }

  async function handleRegister() {
    if (!form.phone_number.trim()) {
      Alert.alert("Required", "Please enter your phone number.");
      return;
    }
    if (!form.farm_name.trim()) {
      Alert.alert("Required", "Please enter your farm name.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.register({
        full_name:    form.full_name.trim(),
        username:     form.username.trim().toLowerCase(),
        password:     form.password,
        phone_number: form.phone_number.trim(),
        farm_name:    form.farm_name.trim(),
        // role and farm_type are NOT sent — backend hardcodes them to "farmer"/"solo"
      });
      if (data?.token) {
        await login({
          token:    data.token,
          farm_id:  data.farm_id,
          is_admin: data.is_admin,
          username: data.username,
        });
        Alert.alert("Welcome! 🐷", data.message || "Account created successfully!");
      }
    } catch (e) {
      Alert.alert("Registration Failed", e.message || "Something went wrong. Please try again.");
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
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={onBack}>
            <Text style={s.backBtnText}>← Back to Login</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 44, marginBottom: 8 }}>🐷</Text>
          <Text style={s.headerTitle}>Create Account</Text>
          <Text style={s.headerSub}>Join Piglytics and start managing your farm</Text>

          {/* Step indicator */}
          <View style={s.stepRow}>
            <View style={[s.stepDot, step >= 1 && s.stepDotActive]} />
            <View style={[s.stepLine, step >= 2 && s.stepLineActive]} />
            <View style={[s.stepDot, step >= 2 && s.stepDotActive]} />
          </View>
          <Text style={s.stepLabel}>
            Step {step} of 2 — {step === 1 ? "Account Info" : "Farm Setup"}
          </Text>
        </View>

        {/* Form card */}
        <View style={s.card}>

          {/* ── STEP 1: account credentials ──────────────────────────────── */}
          {step === 1 && (
            <>
              <Field label="Full name *">
                <InputRow
                  icon="👤"
                  value={form.full_name}
                  onChangeText={v => set("full_name", v)}
                  placeholder="e.g. Juan Dela Cruz"
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </Field>

              <Field label="Username *">
                <InputRow
                  ref={usernameRef}
                  icon="🏷️"
                  value={form.username}
                  onChangeText={v => set("username", v.toLowerCase().replace(/\s/g, ""))}
                  placeholder="e.g. juanfarm"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </Field>

              <Field label="Password * (min. 6 characters)">
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={[s.inputRow, { flex: 1 }]}>
                    <Text style={s.inputIcon}>🔒</Text>
                    <TextInput
                      ref={passwordRef}
                      style={s.input}
                      value={form.password}
                      onChangeText={v => set("password", v)}
                      placeholder="Create password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showPass}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                  <TouchableOpacity style={s.showBtn} onPress={() => setShowPass(!showPass)}>
                    <Text style={s.showBtnText}>{showPass ? "Hide" : "Show"}</Text>
                  </TouchableOpacity>
                </View>
              </Field>

              <Field label="Confirm password *">
                <InputRow
                  ref={confirmRef}
                  icon="🔒"
                  value={form.confirmPass}
                  onChangeText={v => set("confirmPass", v)}
                  placeholder="Re-enter password"
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                />
              </Field>

              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => { if (validateStep1()) setStep(2); }}
              >
                <Text style={s.nextBtnText}>Continue →</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── STEP 2: farm info (no role selection) ────────────────────── */}
          {step === 2 && (
            <>
              <View style={s.farmerBadge}>
                <Text style={{ fontSize: 24 }}>👨‍🌾</Text>
                <View>
                  <Text style={s.farmerBadgeTitle}>Farmer Account</Text>
                  <Text style={s.farmerBadgeSub}>Your account will be registered as a farmer</Text>
                </View>
              </View>

              <Field label="Phone number *">
                <InputRow
                  ref={phoneRef}
                  icon="📱"
                  value={form.phone_number}
                  onChangeText={v => set("phone_number", v)}
                  placeholder="e.g. 09171234567"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => farmRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </Field>

              <Field label="Farm name *">
                <InputRow
                  ref={farmRef}
                  icon="🐷"
                  value={form.farm_name}
                  onChangeText={v => set("farm_name", v)}
                  placeholder="e.g. Dela Cruz Piggery"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </Field>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={s.backStepBtn} onPress={() => setStep(1)}>
                  <Text style={s.backStepText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.registerBtn, loading && { opacity: 0.7 }]}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  {loading
                    ? <ActivityIndicator color={COLORS.white} />
                    : <Text style={s.registerBtnText}>Create Account 🐷</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const InputRow = React.forwardRef(({ icon, ...props }, ref) => (
  <View style={s.inputRow}>
    <Text style={s.inputIcon}>{icon}</Text>
    <TextInput
      ref={ref}
      style={s.input}
      placeholderTextColor={COLORS.textMuted}
      {...props}
    />
  </View>
));

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.primary },
  scroll: { flexGrow: 1, paddingBottom: 48 },

  header:        { alignItems: "center", paddingTop: 40, paddingBottom: 24, paddingHorizontal: 20 },
  backBtn:       { alignSelf: "flex-start", marginBottom: 16 },
  backBtnText:   { color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: "600" },
  headerTitle:   { fontSize: 26, fontWeight: "800", color: COLORS.white },
  headerSub:     { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4, textAlign: "center" },
  stepRow:       { flexDirection: "row", alignItems: "center", marginTop: 18 },
  stepDot:       { width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.3)" },
  stepDotActive: { backgroundColor: COLORS.white },
  stepLine:      { width: 40, height: 2, backgroundColor: "rgba(255,255,255,0.3)", marginHorizontal: 6 },
  stepLineActive:{ backgroundColor: COLORS.white },
  stepLabel:     { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 6 },

  card:  { marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.xxl, padding: 24, ...SHADOW.lg },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },

  farmerBadge:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: COLORS.primary },
  farmerBadgeTitle: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  farmerBadgeSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  inputRow:   { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  inputIcon:  { fontSize: 16 },
  input:      { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 13 },
  showBtn:    { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 13, borderRadius: RADIUS.lg },
  showBtnText:{ fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  nextBtn:      { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center", marginTop: 8 },
  nextBtnText:  { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  backStepBtn:  { flex: 1, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.xl, padding: 15, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  backStepText: { color: COLORS.textSecondary, fontWeight: "600", fontSize: 14 },
  registerBtn:  { flex: 2, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  registerBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});