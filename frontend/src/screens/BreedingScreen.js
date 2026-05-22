import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Modal, TextInput, Alert,
} from "react-native";
import { api } from "../services/api";
 
const STATUS_STYLE = {
  pregnant: { bg: "#E6F1FB", text: "#185FA5" },
  farrowed: { bg: "#EAF3DE", text: "#3B6D11" },
  bred:     { bg: "#F1EFE8", text: "#5F5E5A" },
  open:     { bg: "#F1EFE8", text: "#5F5E5A" },
  failed:   { bg: "#FCEBEB", text: "#A32D2D" },
};
 
export default function BreedingScreen() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ sow: "", breeding_date: "", notes: "" });
  const [saving, setSaving] = useState(false);
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

  function openFarrowingModal(record) {
    setFarrowRecord(record);
    setAliveCount("");
    setDeadCount("");
    setFarrowNotes("");
    setFarrowModal(true);
  }

  async function submitFarrowing() {
    if (!aliveCount) {
      Alert.alert("Required", "Please enter the number of live piglets.");
      return;
    }
    try {
      await api.recordFarrowing(farrowRecord.id, {
        piglets_born_alive: parseInt(aliveCount),
        piglets_born_dead:  parseInt(deadCount || "0"),
        notes: farrowNotes,
      });
      setFarrowModal(false);
      Alert.alert("Recorded!", `Farrowing saved for ${farrowRecord.sow_name}.`);
      load();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }
 
  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

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
      load();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  }
 
  async function updateStatus(id, status) {
    try {
      await api.updateBreeding(id, { pregnancy_status: status });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }
 
  const pregnant = records.filter((r) => r.pregnancy_status === "pregnant").length;
  const farrowed = records.filter((r) => r.pregnancy_status === "farrowed").length;
  const total = records.length;
  const successRate = total > 0 ? Math.round((farrowed / total) * 100) : 0;
 
  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;
 
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={styles.metricRow}>
          <MetricCard label="Pregnant" value={pregnant} color="#185FA5" />
          <MetricCard label="Farrowed" value={farrowed} color="#3B6D11" />
          <MetricCard label="Success rate" value={successRate + "%"} color="#1D9E75" />
        </View>
        <Text style={styles.sectionTitle}>Breeding records</Text>
        {records.map((r) => {
          const st = STATUS_STYLE[r.pregnancy_status] || STATUS_STYLE.bred;
          const daysLeft = r.expected_farrowing_date
            ? Math.max(0, Math.round((new Date(r.expected_farrowing_date) - new Date()) / 86400000))
            : null;
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.sowName}>{r.sow_name}</Text>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.text }]}>{r.pregnancy_status}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Bred on</Text>
                <Text style={styles.infoValue}>{r.breeding_date}</Text>
              </View>
              {r.expected_farrowing_date && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Expected farrowing</Text>
                  <Text style={[styles.infoValue, daysLeft <= 5 && { color: "#BA7517", fontWeight: "700" }]}>
                    {r.expected_farrowing_date} ({daysLeft}d)
                  </Text>
                </View>
              )}
              {r.piglets_born_alive !== null && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Piglets born alive</Text>
                  <Text style={styles.infoValue}>{r.piglets_born_alive}</Text>
                </View>
              )}
              {r.pregnancy_status === "bred" && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => updateStatus(r.id, "pregnant")}>
                  <Text style={styles.actionBtnText}>Mark as pregnant</Text>
                </TouchableOpacity>
              )}
              {r.pregnancy_status === "pregnant" && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#E1F5EE" }]}
                  onPress={() => openFarrowingModal(r)}
                >
                  <Text style={[styles.actionBtnText, { color: "#0F6E56" }]}>
                    Mark as farrowed
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
 
      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Text style={styles.fabText}>+ Add record</Text>
      </TouchableOpacity>
 
      {/* Farrowing Modal */}
      <Modal visible={farrowModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Record farrowing — {farrowRecord?.sow_name}
            </Text>
            <TouchableOpacity onPress={() => setFarrowModal(false)}>
              <Text style={{ color: "#888780", fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Live piglets born *</Text>
            <TextInput style={styles.input} value={aliveCount}
              onChangeText={setAliveCount} placeholder="e.g. 10"
              placeholderTextColor="#B4B2A9" keyboardType="number-pad" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              Dead piglets (optional)
            </Text>
            <TextInput style={styles.input} value={deadCount}
              onChangeText={setDeadCount} placeholder="e.g. 1"
              placeholderTextColor="#B4B2A9" keyboardType="number-pad" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
              Notes (optional)
            </Text>
            <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]}
              value={farrowNotes} onChangeText={setFarrowNotes}
              placeholder="Any observations during delivery..."
              placeholderTextColor="#B4B2A9" multiline />

            <TouchableOpacity style={styles.saveBtn} onPress={submitFarrowing}>
              <Text style={styles.saveBtnText}>Save farrowing record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
 
function MetricCard({ label, value, color }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  metricRow: { flexDirection: "row", gap: 10 },
  metric: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#D3D1C7", alignItems: "center" },
  metricValue: { fontSize: 24, fontWeight: "700" },
  metricLabel: { fontSize: 11, color: "#888780", marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2A" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#D3D1C7" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sowName: { fontSize: 15, fontWeight: "700", color: "#2C2C2A" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: "#E8E7E0" },
  infoLabel: { fontSize: 13, color: "#888780" },
  infoValue: { fontSize: 13, color: "#2C2C2A", fontWeight: "500" },
  actionBtn: { marginTop: 10, backgroundColor: "#FAEEDA", borderRadius: 8, paddingVertical: 9, alignItems: "center" },
  actionBtnText: { color: "#854F0B", fontWeight: "600", fontSize: 13 },
  fab: { position: "absolute", bottom: 24, right: 20, backgroundColor: "#1D9E75", borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12, elevation: 5 },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modal: { flex: 1, backgroundColor: "#F8F7F2" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#2C2C2A" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 13, color: "#5F5E5A", marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 14, color: "#2C2C2A", borderWidth: 0.5, borderColor: "#D3D1C7" },
  hint: { fontSize: 12, color: "#B4B2A9", fontStyle: "italic", marginTop: 12 },
  saveBtn: { marginTop: 24, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
