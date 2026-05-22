import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";

const SEVERITY_STYLE = {
  normal:   { bg: "#EAF3DE", text: "#3B6D11", label: "✅ Normal"   },
  warning:  { bg: "#FAEEDA", text: "#854F0B", label: "⚠️ Warning"  },
  critical: { bg: "#FCEBEB", text: "#A32D2D", label: "🔴 Critical" },
};

export default function HealthLogScreen({ route }) {
  const { pig } = route.params;

  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]   = useState(false);

  const [form, setForm] = useState({
    temperature_c:    "",
    respiratory_rate: "",
    heart_rate:       "",
    appetite:         "normal",
    behavior:         "normal",
    stool_condition:  "normal",
    has_cough:            false,
    has_nasal_discharge:  false,
    has_skin_lesions:     false,
    has_lameness:         false,
    has_vomiting:         false,
    notes: "",
  });

  function setF(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

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
        temperature_c:    form.temperature_c    ? parseFloat(form.temperature_c)    : null,
        respiratory_rate: form.respiratory_rate ? parseInt(form.respiratory_rate)   : null,
        heart_rate:       form.heart_rate       ? parseInt(form.heart_rate)         : null,
      };
      const result = await api.addHealthLog(pig.id, payload);

      // Show what the system found
      const st = SEVERITY_STYLE[result.severity] || SEVERITY_STYLE.normal;
      Alert.alert(
        st.label,
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
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>

        {/* Log form */}
        <TouchableOpacity style={s.toggleBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.toggleBtnText}>{showForm ? "▲ Cancel" : "+ Log health check"}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={s.form}>
            <Text style={s.formTitle}>Health Check — {pig.name}</Text>
            <Text style={s.hint}>Fill in what you can observe. Leave blank if not measured.</Text>

            {/* Vitals */}
            <Text style={s.sectionLabel}>📊 Vitals</Text>
            <Row label="Temperature (°C)">
              <TextInput style={s.input} value={form.temperature_c}
                onChangeText={v => setF("temperature_c", v)}
                placeholder="e.g. 38.5" placeholderTextColor="#B4B2A9"
                keyboardType="decimal-pad" />
            </Row>
            <Row label="Respiratory rate (breaths/min)">
              <TextInput style={s.input} value={form.respiratory_rate}
                onChangeText={v => setF("respiratory_rate", v)}
                placeholder="e.g. 18" placeholderTextColor="#B4B2A9"
                keyboardType="number-pad" />
            </Row>
            <Row label="Heart rate (BPM)">
              <TextInput style={s.input} value={form.heart_rate}
                onChangeText={v => setF("heart_rate", v)}
                placeholder="e.g. 70" placeholderTextColor="#B4B2A9"
                keyboardType="number-pad" />
            </Row>

            {/* Appetite */}
            <Text style={s.sectionLabel}>🍽 Appetite</Text>
            <ChipGroup
              options={["normal","poor","none"]}
              labels={["Normal","Poor","Not eating"]}
              value={form.appetite}
              onChange={v => setF("appetite", v)}
            />

            {/* Behavior */}
            <Text style={s.sectionLabel}>🐷 Behavior</Text>
            <ChipGroup
              options={["normal","lethargic","aggressive","isolating"]}
              labels={["Normal","Lethargic","Aggressive","Isolating"]}
              value={form.behavior}
              onChange={v => setF("behavior", v)}
            />

            {/* Stool */}
            <Text style={s.sectionLabel}>💩 Stool condition</Text>
            <ChipGroup
              options={["normal","diarrhea","constipated","bloody"]}
              labels={["Normal","Diarrhea","Constipated","Bloody"]}
              value={form.stool_condition}
              onChange={v => setF("stool_condition", v)}
            />

            {/* Physical signs */}
            <Text style={s.sectionLabel}>🔍 Physical signs observed</Text>
            {[
              { key: "has_cough",            label: "Coughing" },
              { key: "has_nasal_discharge",  label: "Nasal discharge" },
              { key: "has_skin_lesions",     label: "Skin lesions" },
              { key: "has_lameness",         label: "Lameness / limping" },
              { key: "has_vomiting",         label: "Vomiting" },
            ].map(item => (
              <View key={item.key} style={s.switchRow}>
                <Text style={s.switchLabel}>{item.label}</Text>
                <Switch
                  value={form[item.key]}
                  onValueChange={v => setF(item.key, v)}
                  trackColor={{ true: "#1D9E75" }}
                  thumbColor={form[item.key] ? "#fff" : "#f4f3f4"}
                />
              </View>
            ))}

            {/* Notes */}
            <Text style={s.sectionLabel}>📝 Additional notes</Text>
            <TextInput style={[s.input, { height: 80, textAlignVertical: "top" }]}
              value={form.notes} onChangeText={v => setF("notes", v)}
              placeholder="Any other observations..." placeholderTextColor="#B4B2A9"
              multiline />

            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>Submit & Evaluate</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Past logs */}
        <Text style={s.sectionLabel}>Past health logs</Text>
        {logs.length === 0 && (
          <Text style={{ color: "#B4B2A9", textAlign: "center", marginTop: 10 }}>
            No health logs yet. Log the first check above.
          </Text>
        )}
        {logs.map((log, i) => {
          const st = SEVERITY_STYLE[log.severity] || SEVERITY_STYLE.normal;
          return (
            <View key={i} style={[s.logCard, { borderLeftColor: st.text }]}>
              <View style={s.logHeader}>
                <Text style={s.logDate}>{log.date_logged} {log.time_logged?.slice(0,5)}</Text>
                <View style={[s.badge, { backgroundColor: st.bg }]}>
                  <Text style={[s.badgeText, { color: st.text }]}>{st.label}</Text>
                </View>
              </View>
              {log.temperature_c && (
                <Text style={s.logDetail}>🌡 Temp: {log.temperature_c}°C</Text>
              )}
              {log.respiratory_rate && (
                <Text style={s.logDetail}>💨 Resp: {log.respiratory_rate} breaths/min</Text>
              )}
              {log.heart_rate && (
                <Text style={s.logDetail}>❤️ HR: {log.heart_rate} BPM</Text>
              )}
              <Text style={s.logDetail}>🍽 Appetite: {log.appetite} · 🐷 Behavior: {log.behavior}</Text>
              {log.system_findings ? (
                <View style={[s.findingsBox, { backgroundColor: st.bg }]}>
                  <Text style={[s.findingsText, { color: st.text }]}>
                    System findings:{"\n"}{log.system_findings}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function Row({ label, children }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipGroup({ options, labels, value, onChange }) {
  return (
    <View style={s.chipRow}>
      {options.map((opt, i) => (
        <TouchableOpacity key={opt}
          style={[s.chip, value === opt && s.chipActive]}
          onPress={() => onChange(opt)}>
          <Text style={[s.chipText, value === opt && s.chipTextActive]}>
            {labels[i]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#F8F7F2" },
  toggleBtn:     { backgroundColor: "#1D9E75", borderRadius: 12, padding: 14, alignItems: "center" },
  toggleBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  form:          { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#D3D1C7" },
  formTitle:     { fontSize: 16, fontWeight: "700", color: "#2C2C2A", marginBottom: 4 },
  hint:          { fontSize: 12, color: "#888780", marginBottom: 14, fontStyle: "italic" },
  sectionLabel:  { fontSize: 13, fontWeight: "700", color: "#1D9E75", marginTop: 14, marginBottom: 8 },
  row:           { marginBottom: 10 },
  rowLabel:      { fontSize: 13, color: "#5F5E5A", marginBottom: 5 },
  input:         { backgroundColor: "#F8F7F2", borderRadius: 10, padding: 12, fontSize: 14, color: "#2C2C2A", borderWidth: 0.5, borderColor: "#D3D1C7" },
  chipRow:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5, borderColor: "#D3D1C7", backgroundColor: "#F8F7F2" },
  chipActive:    { backgroundColor: "#1D9E75", borderColor: "#1D9E75" },
  chipText:      { fontSize: 13, color: "#5F5E5A" },
  chipTextActive:{ color: "#fff", fontWeight: "600" },
  switchRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F0EFE8" },
  switchLabel:   { fontSize: 14, color: "#2C2C2A" },
  submitBtn:     { marginTop: 20, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  logCard:       { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#D3D1C7", borderLeftWidth: 4 },
  logHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  logDate:       { fontSize: 13, fontWeight: "600", color: "#2C2C2A" },
  badge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText:     { fontSize: 11, fontWeight: "700" },
  logDetail:     { fontSize: 12, color: "#5F5E5A", marginBottom: 3 },
  findingsBox:   { marginTop: 10, borderRadius: 8, padding: 10 },
  findingsText:  { fontSize: 12, lineHeight: 18 },
});