import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const SEVERITY_CONFIG = {
  normal:   { bg: COLORS.healthyBg, text: COLORS.healthy, icon: "✅", label: "Normal"   },
  warning:  { bg: COLORS.warningBg, text: COLORS.warning, icon: "⚠️", label: "Warning"  },
  critical: { bg: COLORS.dangerBg,  text: COLORS.danger,  icon: "🔴", label: "Critical" },
};

export default function HealthLogScreen({ route }) {
  const { pig } = route.params;
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    temperature_c: "", respiratory_rate: "", heart_rate: "",
    appetite: "normal", behavior: "normal", stool_condition: "normal",
    has_cough: false, has_nasal_discharge: false, has_skin_lesions: false,
    has_lameness: false, has_vomiting: false, notes: "",
  });

  function setF(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  useFocusEffect(useCallback(() => {
    api.getHealthLogs(pig.id)
      .then(d => setLogs(d.results || d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []));

  async function handleSubmit() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        temperature_c:    form.temperature_c    ? parseFloat(form.temperature_c)  : null,
        respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate) : null,
        heart_rate:       form.heart_rate       ? parseInt(form.heart_rate)       : null,
      };
      const result = await api.addHealthLog(pig.id, payload);
      const cfg = SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.normal;
      Alert.alert(
        `${cfg.icon} ${cfg.label}`,
        result.system_findings,
        [{ text: "OK", onPress: () => {
          setShowForm(false);
          setLogs(prev => [result, ...prev]);
          setForm({
            temperature_c: "", respiratory_rate: "", heart_rate: "",
            appetite: "normal", behavior: "normal", stool_condition: "normal",
            has_cough: false, has_nasal_discharge: false, has_skin_lesions: false,
            has_lameness: false, has_vomiting: false, notes: "",
          });
        }}]
      );
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={s.screen}>
      {/* Pig header — sits outside the keyboard view intentionally (fixed at top) */}
      <View style={s.pigHeader}>
        <View style={s.pigAvatarWrap}>
          <Text style={{ fontSize: 28 }}>🐷</Text>
        </View>
        <View>
          <Text style={s.pigHeaderId}>{pig.pig_id}</Text>
          <Text style={s.pigHeaderName}>{pig.name}</Text>
          <Text style={s.pigHeaderMeta}>
            {pig.growth_stage?.charAt(0).toUpperCase() + pig.growth_stage?.slice(1)}
            {pig.latest_weight ? ` • ${pig.latest_weight} kg` : ""}
          </Text>
        </View>
      </View>

      {/*
       * KeyboardAvoidingView wraps only the scrollable content below the header.
       * This way the pig header stays pinned at the top and only the form area
       * adjusts when the keyboard appears.
       *
       * iOS:     behavior="padding" adds padding below the scroll view equal
       *          to keyboard height. keyboardVerticalOffset compensates for
       *          the stack header + pig header combined (~56 + 88 = ~144).
       * Android: behavior="height" shrinks the view by keyboard height.
       *          No offset needed because Android resizes the window.
       */}
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 144 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Toggle form button */}
          <TouchableOpacity
            style={[s.toggleBtn, showForm && s.toggleBtnActive]}
            onPress={() => setShowForm(!showForm)}
          >
            <Text style={s.toggleBtnIcon}>{showForm ? "▲" : "🩺"}</Text>
            <Text style={s.toggleBtnText}>
              {showForm ? "Cancel health check" : "Record New Health Log"}
            </Text>
          </TouchableOpacity>

          {/* Form */}
          {showForm && (
            <View style={s.formCard}>
              <Text style={s.formHint}>
                Fill in what you can observe. Leave fields blank if not measured.
              </Text>

              {/* Vitals */}
              <FormSection title="📊 Vitals">
                <VitalInput
                  label="Temperature (°C)" placeholder="e.g. 38.5"
                  value={form.temperature_c} onChangeText={v => setF("temperature_c", v)}
                  keyboardType="decimal-pad" hint="Normal: 38–39.5°C" />
                <VitalInput
                  label="Respiratory rate (breaths/min)" placeholder="e.g. 18"
                  value={form.respiratory_rate} onChangeText={v => setF("respiratory_rate", v)}
                  keyboardType="number-pad" hint="Normal: 15–25" />
                <VitalInput
                  label="Heart rate (BPM)" placeholder="e.g. 70"
                  value={form.heart_rate} onChangeText={v => setF("heart_rate", v)}
                  keyboardType="number-pad" hint="Normal: 60–80" />
              </FormSection>

              {/* Appetite */}
              <FormSection title="🍽 Appetite">
                <ChipGroup
                  options={["normal", "poor", "none"]}
                  labels={["Normal", "Poor", "Not eating"]}
                  colors={[COLORS.healthy, COLORS.warning, COLORS.danger]}
                  bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.dangerBg]}
                  value={form.appetite} onChange={v => setF("appetite", v)} />
              </FormSection>

              {/* Behavior */}
              <FormSection title="🐷 Behavior">
                <ChipGroup
                  options={["normal", "lethargic", "aggressive", "isolating"]}
                  labels={["Normal", "Lethargic", "Aggressive", "Isolating"]}
                  colors={[COLORS.healthy, COLORS.warning, COLORS.danger, COLORS.warning]}
                  bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.dangerBg, COLORS.warningBg]}
                  value={form.behavior} onChange={v => setF("behavior", v)} />
              </FormSection>

              {/* Stool */}
              <FormSection title="💩 Stool Condition">
                <ChipGroup
                  options={["normal", "diarrhea", "constipated", "bloody"]}
                  labels={["Normal", "Diarrhea", "Constipated", "Bloody"]}
                  colors={[COLORS.healthy, COLORS.warning, COLORS.warning, COLORS.danger]}
                  bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.warningBg, COLORS.dangerBg]}
                  value={form.stool_condition} onChange={v => setF("stool_condition", v)} />
              </FormSection>

              {/* Physical signs */}
              <FormSection title="🔍 Physical Signs Observed">
                {[
                  { key: "has_cough",           label: "Coughing",           icon: "😮‍💨" },
                  { key: "has_nasal_discharge",  label: "Nasal discharge",    icon: "🤧" },
                  { key: "has_skin_lesions",     label: "Skin lesions",       icon: "🩹" },
                  { key: "has_lameness",         label: "Lameness / limping", icon: "🦵" },
                  { key: "has_vomiting",         label: "Vomiting",           icon: "🤢" },
                ].map(item => (
                  <View key={item.key} style={s.switchRow}>
                    <Text style={s.switchIcon}>{item.icon}</Text>
                    <Text style={s.switchLabel}>{item.label}</Text>
                    <Switch
                      value={form[item.key]}
                      onValueChange={v => setF(item.key, v)}
                      trackColor={{ false: COLORS.border, true: COLORS.primary }}
                      thumbColor={form[item.key] ? COLORS.white : "#f4f4f4"}
                    />
                  </View>
                ))}
              </FormSection>

              {/* Notes */}
              <FormSection title="📝 Additional Notes">
                <TextInput
                  style={s.notesInput}
                  value={form.notes}
                  onChangeText={v => setF("notes", v)}
                  placeholder="Any other observations..."
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  returnKeyType="done"
                />
              </FormSection>

              <TouchableOpacity
                style={[s.submitBtn, saving && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={s.submitBtnText}>🩺  Submit & Evaluate</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Past logs */}
          <Text style={s.sectionTitle}>Past Health Logs</Text>
          {logs.length === 0 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={s.emptyTitle}>No health logs yet</Text>
              <Text style={s.emptySub}>Tap "Record New Health Log" to start monitoring</Text>
            </View>
          )}
          {logs.map((log, i) => {
            const cfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.normal;
            return (
              <View key={i} style={[s.logCard, { borderLeftColor: cfg.text }]}>
                <View style={s.logHeader}>
                  <View style={[s.logSeverityBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
                    <Text style={[s.logSeverityText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  <Text style={s.logTime}>{log.date_logged} {log.time_logged?.slice(0, 5)}</Text>
                </View>

                <View style={s.logVitals}>
                  {log.temperature_c    && <VitalBadge icon="🌡" label={`${log.temperature_c}°C`} />}
                  {log.respiratory_rate && <VitalBadge icon="💨" label={`${log.respiratory_rate} br/min`} />}
                  {log.heart_rate       && <VitalBadge icon="❤️" label={`${log.heart_rate} BPM`} />}
                </View>

                <Text style={s.logObservation}>
                  🍽 {log.appetite}  •  🐷 {log.behavior}  •  💩 {log.stool_condition}
                </Text>

                {log.system_findings && (
                  <View style={[s.findingsBox, { backgroundColor: cfg.bg }]}>
                    <Text style={s.findingsLabel}>System findings:</Text>
                    <Text style={[s.findingsText, { color: cfg.text }]}>{log.system_findings}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function FormSection({ title, children }) {
  return (
    <View style={s.formSection}>
      <Text style={s.formSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function VitalInput({ label, placeholder, value, onChangeText, keyboardType, hint }) {
  return (
    <View style={s.vitalRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.vitalLabel}>{label}</Text>
        {hint && <Text style={s.vitalHint}>{hint}</Text>}
      </View>
      <TextInput
        style={s.vitalInput}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        returnKeyType="done"
      />
    </View>
  );
}

function ChipGroup({ options, labels, colors, bgs, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt, i) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, active && { backgroundColor: bgs[i], borderColor: colors[i] }]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, active && { color: colors[i], fontWeight: "700" }]}>
              {labels[i]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function VitalBadge({ icon, label }) {
  return (
    <View style={s.vitalBadge}>
      <Text style={{ fontSize: 12 }}>{icon}</Text>
      <Text style={s.vitalBadgeText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  flex:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  pigHeader:    { backgroundColor: COLORS.primary, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  pigAvatarWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  pigHeaderId:  { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" },
  pigHeaderName:{ fontSize: 20, fontWeight: "800", color: COLORS.white },
  pigHeaderMeta:{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  toggleBtn:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1.5, borderColor: COLORS.primary, ...SHADOW.sm },
  toggleBtnActive: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger },
  toggleBtnIcon:   { fontSize: 20 },
  toggleBtnText:   { fontSize: 15, fontWeight: "700", color: COLORS.primary },

  formCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, gap: 16, ...SHADOW.sm },
  formHint: { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10 },

  formSection:      { gap: 10 },
  formSectionTitle: { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  vitalRow:   { flexDirection: "row", alignItems: "center", gap: 12 },
  vitalLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "500" },
  vitalHint:  { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  vitalInput: { width: 100, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, textAlign: "center" },

  chip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg },
  chipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },

  switchRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  switchIcon:  { fontSize: 18, width: 28 },
  switchLabel: { flex: 1, fontSize: 14, color: COLORS.textPrimary },

  notesInput: { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, minHeight: 80, textAlignVertical: "top" },

  submitBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  submitBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptyState:   { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle:   { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:     { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },

  logCard:          { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, borderLeftWidth: 3, ...SHADOW.sm },
  logHeader:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logSeverityBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  logSeverityText:  { fontSize: 12, fontWeight: "700" },
  logTime:          { fontSize: 11, color: COLORS.textMuted },
  logVitals:        { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  vitalBadge:       { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  vitalBadgeText:   { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },
  logObservation:   { fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },
  findingsBox:      { borderRadius: RADIUS.md, padding: 10, marginTop: 4 },
  findingsLabel:    { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, marginBottom: 4 },
  findingsText:     { fontSize: 12, lineHeight: 18 },
});