import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const STATUS_CONFIG = {
  pregnant: { bg: COLORS.blueBg,     text: COLORS.blue,    icon: "🤰", label: "Pregnant"  },
  farrowed: { bg: COLORS.healthyBg,  text: COLORS.healthy, icon: "🐣", label: "Farrowed"  },
  bred:     { bg: "#F3E8FF",          text: "#9333EA",      icon: "🌸", label: "Bred"       },
  open:     { bg: COLORS.screenBg,   text: COLORS.textMuted,icon: "⭕", label: "Open"      },
  failed:   { bg: COLORS.dangerBg,   text: COLORS.danger,  icon: "❌", label: "Failed"     },
};

export default function BreedingScreen() {
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState({ sow: "", breeding_date: "", notes: "" });
  const [saving, setSaving]       = useState(false);
  const [farrowModal, setFarrowModal]   = useState(false);
  const [farrowRecord, setFarrowRecord] = useState(null);
  const [aliveCount, setAliveCount]     = useState("");
  const [deadCount, setDeadCount]       = useState("");
  const [farrowNotes, setFarrowNotes]   = useState("");

  async function load() {
    try {
      const data = await api.getBreeding();
      setRecords(data.results || data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function openFarrowingModal(record) {
    setFarrowRecord(record);
    setAliveCount(""); setDeadCount(""); setFarrowNotes("");
    setFarrowModal(true);
  }

  async function submitFarrowing() {
    if (!aliveCount) { Alert.alert("Required", "Enter the number of live piglets."); return; }
    try {
      await api.recordFarrowing(farrowRecord.id, {
        piglets_born_alive: parseInt(aliveCount),
        piglets_born_dead:  parseInt(deadCount || "0"),
        notes: farrowNotes,
      });
      setFarrowModal(false);
      Alert.alert("Recorded! 🐣", `Farrowing saved for ${farrowRecord.sow_name}.`);
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  async function handleAdd() {
    if (!form.sow || !form.breeding_date) {
      Alert.alert("Missing fields", "Sow ID and breeding date are required.");
      return;
    }
    setSaving(true);
    try {
      await api.addBreeding(form);
      setShowModal(false);
      setForm({ sow: "", breeding_date: "", notes: "" });
      Alert.alert("Saved! 🌸", "Breeding record added.");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    try {
      await api.updateBreeding(id, { pregnancy_status: status });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  const pregnant    = records.filter(r => r.pregnancy_status === "pregnant").length;
  const farrowed    = records.filter(r => r.pregnancy_status === "farrowed").length;
  const successRate = records.length > 0 ? Math.round((farrowed / records.length) * 100) : 0;

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Metric cards */}
        <View style={s.metricsRow}>
          <MetricCard icon="🤰" label="Pregnant" value={pregnant}       color={COLORS.blue}    bg={COLORS.blueBg} />
          <MetricCard icon="🐣" label="Farrowed" value={farrowed}       color={COLORS.healthy} bg={COLORS.healthyBg} />
          <MetricCard icon="📊" label="Success"  value={successRate+"%"} color={COLORS.primary} bg={COLORS.primaryLight} />
        </View>

        {/* Records */}
        <Text style={s.sectionTitle}>Breeding Records</Text>
        {records.length === 0 && (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 48 }}>🌸</Text>
            <Text style={s.emptyTitle}>No breeding records</Text>
            <Text style={s.emptySub}>Tap the button below to add a record</Text>
          </View>
        )}
        {records.map(r => {
          const cfg = STATUS_CONFIG[r.pregnancy_status] || STATUS_CONFIG.bred;
          const daysLeft = r.expected_farrowing_date
            ? Math.max(0, Math.round((new Date(r.expected_farrowing_date) - new Date()) / 86400000))
            : null;
          const isUrgent = daysLeft !== null && daysLeft <= 5;

          return (
            <View key={r.id} style={[s.card, isUrgent && s.cardUrgent]}>
              <View style={s.cardHeader}>
                <View style={[s.statusIcon, { backgroundColor: cfg.bg }]}>
                  <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sowName}>{r.sow_name}</Text>
                  <Text style={s.breedDate}>Bred: {r.breeding_date}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              </View>

              {r.expected_farrowing_date && (
                <View style={[s.farrowRow, isUrgent && s.farrowRowUrgent]}>
                  <Text style={s.farrowLabel}>Expected farrowing</Text>
                  <Text style={[s.farrowValue, isUrgent && { color: COLORS.danger, fontWeight: "700" }]}>
                    {r.expected_farrowing_date}
                    {daysLeft !== null ? ` (${daysLeft}d)` : ""}
                    {isUrgent ? " ⚠️" : ""}
                  </Text>
                </View>
              )}

              {r.piglets_born_alive !== null && (
                <View style={s.pigletsRow}>
                  <View style={s.pigletBadge}>
                    <Text style={s.pigletBadgeText}>🐣 {r.piglets_born_alive} live</Text>
                  </View>
                  {r.piglets_born_dead > 0 && (
                    <View style={[s.pigletBadge, { backgroundColor: COLORS.dangerBg }]}>
                      <Text style={[s.pigletBadgeText, { color: COLORS.danger }]}>💀 {r.piglets_born_dead} dead</Text>
                    </View>
                  )}
                </View>
              )}

              {r.pregnancy_status === "bred" && (
                <TouchableOpacity style={s.actionBtn} onPress={() => updateStatus(r.id, "pregnant")}>
                  <Text style={s.actionBtnText}>🤰 Mark as Pregnant</Text>
                </TouchableOpacity>
              )}
              {r.pregnancy_status === "pregnant" && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen]} onPress={() => openFarrowingModal(r)}>
                  <Text style={[s.actionBtnText, { color: COLORS.primary }]}>🐣 Mark as Farrowed</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)}>
        <Text style={s.fabText}>+ Add Record</Text>
      </TouchableOpacity>

      {/* Add Record Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Breeding Record</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <ModalField label="Sow pig ID (database number) *">
              <TextInput style={s.modalInput} value={form.sow}
                onChangeText={v => setForm(f => ({ ...f, sow: v }))}
                placeholder="e.g. 3" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
            </ModalField>
            <ModalField label="Breeding date * (YYYY-MM-DD)">
              <TextInput style={s.modalInput} value={form.breeding_date}
                onChangeText={v => setForm(f => ({ ...f, breeding_date: v }))}
                placeholder="e.g. 2025-06-01" placeholderTextColor={COLORS.textMuted} />
            </ModalField>
            <ModalField label="Notes (optional)">
              <TextInput style={[s.modalInput, { height: 80, textAlignVertical: "top" }]}
                value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Any observations..." placeholderTextColor={COLORS.textMuted} multiline />
            </ModalField>
            <View style={s.infoBox}>
              <Text style={s.infoBoxText}>
                ℹ️  Expected farrowing date (114 days) will be calculated automatically.
              </Text>
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.saveBtnText}>Save Record</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Farrowing Modal */}
      <Modal visible={farrowModal} animationType="slide" presentationStyle="pageSheet">
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Record Farrowing — {farrowRecord?.sow_name}</Text>
            <TouchableOpacity onPress={() => setFarrowModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <ModalField label="Live piglets born *">
              <TextInput style={s.modalInput} value={aliveCount} onChangeText={setAliveCount}
                placeholder="e.g. 10" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
            </ModalField>
            <ModalField label="Dead piglets (optional)">
              <TextInput style={s.modalInput} value={deadCount} onChangeText={setDeadCount}
                placeholder="e.g. 1" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
            </ModalField>
            <ModalField label="Notes (optional)">
              <TextInput style={[s.modalInput, { height: 80, textAlignVertical: "top" }]}
                value={farrowNotes} onChangeText={setFarrowNotes}
                placeholder="Any observations during delivery..." placeholderTextColor={COLORS.textMuted} multiline />
            </ModalField>
            <TouchableOpacity style={s.saveBtn} onPress={submitFarrowing}>
              <Text style={s.saveBtnText}>Save Farrowing Record</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function MetricCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.metricCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 24, marginBottom: 4 }}>{icon}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function ModalField({ label, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.modalFieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg },

  metricsRow:  { flexDirection: "row", gap: 10 },
  metricCard:  { flex: 1, borderRadius: RADIUS.xl, padding: 14, alignItems: "center", ...SHADOW.sm },
  metricValue: { fontSize: 22, fontWeight: "800" },
  metricLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 4 },

  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardUrgent: { borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  statusIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  sowName:    { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  breedDate:  { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusBadgeText:{ fontSize: 12, fontWeight: "700" },

  farrowRow:       { flexDirection: "row", justifyContent: "space-between", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 },
  farrowRowUrgent: { backgroundColor: COLORS.dangerBg },
  farrowLabel:     { fontSize: 12, color: COLORS.textMuted },
  farrowValue:     { fontSize: 12, color: COLORS.textPrimary, fontWeight: "600" },

  pigletsRow:    { flexDirection: "row", gap: 8, marginBottom: 10 },
  pigletBadge:   { backgroundColor: COLORS.healthyBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  pigletBadgeText:{ fontSize: 12, color: COLORS.healthy, fontWeight: "600" },

  actionBtn:      { backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: "center" },
  actionBtnGreen: { backgroundColor: COLORS.primaryLight },
  actionBtnText:  { color: COLORS.warning, fontWeight: "700", fontSize: 13 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:   { fontSize: 13, color: COLORS.textMuted },

  fab:     { position: "absolute", bottom: 24, alignSelf: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 14, ...SHADOW.lg },
  fabText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },

  modal:          { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary, flex: 1 },
  modalClose:     { fontSize: 18, color: COLORS.textMuted },
  modalInput:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  modalFieldLabel:{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  infoBox:        { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 12, marginBottom: 14 },
  infoBoxText:    { fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  saveBtn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  saveBtnText:    { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});