import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, TextInput, Alert,
} from "react-native";
import { api } from "../services/api";
 
export default function PigDetailScreen({ route, navigation }) {
  const { pig: initialPig } = route.params;
  const [pig, setPig] = useState(null);
  const [tab, setTab] = useState("info");
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [vaxModal, setVaxModal]         = useState(false);
  const [vaxForm, setVaxForm]           = useState({ vaccine_name: "", next_due_date: "", administered_by: "" });
  const [savingVax, setSavingVax]       = useState(false);
 
  async function load() {
    try {
      const data = await api.getPig(initialPig.id);
      setPig(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
 
  useEffect(() => { load(); }, []);
 
  async function handleDelete() {
    Alert.alert(
      "Delete pig",
      `Are you sure you want to delete ${pig.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deletePig(pig.id);
              Alert.alert("Deleted", `${pig.name} has been removed.`, [
                { text: "OK", onPress: () => navigation.goBack() },
              ]);
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  async function scheduleVaccination() {
    if (!vaxForm.vaccine_name || !vaxForm.next_due_date) {
      Alert.alert("Required", "Please enter vaccine name and due date.");
      return;
    }
    setSavingVax(true);
    try {
      await api.scheduleVaccination(pig.id, {
        ...vaxForm,
        date_given: new Date().toISOString().split("T")[0],
      });
      Alert.alert("Scheduled!", `${vaxForm.vaccine_name} has been scheduled.`);
      setVaxModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSavingVax(false); }
  }

  async function logWeight() {
    if (!weightInput) return;
    try {
      await api.logWeight(pig.id, {
        weight_kg: weightInput,
        recorded_at: new Date().toISOString().split("T")[0],
      });
      setWeightInput("");
      Alert.alert("Success", "Weight logged!");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

 
  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;
 
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{pig.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.pigName}>{pig.name}</Text>
          <Text style={styles.pigMeta}>{pig.pig_id} · {pig.breed} · {pig.gender}</Text>
          <Text style={styles.pigMeta}>{pig.age_in_months} months old · {pig.growth_stage}</Text>
        </View>
        <TouchableOpacity style={styles.deleteHeaderBtn} onPress={handleDelete}>
          <Text style={styles.deleteHeaderIcon}>🗑</Text>
          <Text style={styles.deleteHeaderText}>Delete</Text>
        </TouchableOpacity>
      </View>
 
      <View style={styles.tabRow}>
        {["info", "health", "weight", "breeding"].map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
 
      <View style={styles.content}>
        {tab === "info" && (
          <View>
            <InfoRow label="Current weight" value={pig.latest_weight ? pig.latest_weight + " kg" : "Not recorded"} />
            <InfoRow label="Date of birth" value={pig.date_of_birth} />
            <InfoRow label="Health status" value={pig.health_status.replace("_", " ")} />
            <InfoRow label="Last check-up" value={pig.last_checkup_date || "—"} />
            {pig.notes ? <InfoRow label="Notes" value={pig.notes} /> : null}
          </View>
        )}
 
        {tab === "health" && (
          <View>
            <TouchableOpacity
              style={{
                backgroundColor: "#1D9E75", borderRadius: 10,
                padding: 12, alignItems: "center", marginBottom: 16,
              }}
              onPress={() => navigation.navigate("HealthLog", { pig })}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                + Log health check
              </Text>
            </TouchableOpacity>
            <Text style={styles.subTitle}>Vaccinations</Text>
            <TouchableOpacity
              style={{ backgroundColor: "#E6F1FB", borderRadius: 8, padding: 10, alignItems: "center", marginBottom: 12 }}
              onPress={() => setVaxModal(true)}
            >
              <Text style={{ color: "#185FA5", fontWeight: "600", fontSize: 13 }}>
                + Schedule vaccination
              </Text>
            </TouchableOpacity>
            {pig.vaccinations?.length === 0 && <Text style={styles.empty}>No vaccinations recorded.</Text>}
            {pig.vaccinations?.map((v) => (
              <RecordCard key={v.id} title={v.vaccine_name}
                sub={"Given: " + v.date_given}
                extra={v.next_due_date ? "Due: " + v.next_due_date : ""} />
            ))}

            {/* Vaccination scheduling modal */}
            <Modal visible={vaxModal} animationType="slide" presentationStyle="pageSheet">
              <View style={{ flex: 1, backgroundColor: "#F8F7F2" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" }}>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: "#2C2C2A" }}>Schedule vaccination</Text>
                  <TouchableOpacity onPress={() => setVaxModal(false)}>
                    <Text style={{ color: "#888780", fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ padding: 20 }}>
                  <Text style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 6, fontWeight: "500" }}>Vaccine name *</Text>
                  <TextInput style={styles.weightInput}
                    value={vaxForm.vaccine_name}
                    onChangeText={v => setVaxForm(f => ({ ...f, vaccine_name: v }))}
                    placeholder="e.g. Hog Cholera" placeholderTextColor="#B4B2A9" />

                  <Text style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 6, marginTop: 14, fontWeight: "500" }}>Due date * (YYYY-MM-DD)</Text>
                  <TextInput style={styles.weightInput}
                    value={vaxForm.next_due_date}
                    onChangeText={v => setVaxForm(f => ({ ...f, next_due_date: v }))}
                    placeholder="e.g. 2025-06-15" placeholderTextColor="#B4B2A9" />

                  <Text style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 6, marginTop: 14, fontWeight: "500" }}>Veterinarian (optional)</Text>
                  <TextInput style={styles.weightInput}
                    value={vaxForm.administered_by}
                    onChangeText={v => setVaxForm(f => ({ ...f, administered_by: v }))}
                    placeholder="e.g. Dr. Santos" placeholderTextColor="#B4B2A9" />

                  <TouchableOpacity
                    style={{ marginTop: 24, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" }}
                    onPress={scheduleVaccination} disabled={savingVax}>
                    {savingVax
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save schedule</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        )}
        {tab === "weight" && (
          <View>
            <Text style={styles.subTitle}>Log new weight</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={styles.weightInput}
                placeholder="e.g. 55.5"
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.logBtn} onPress={logWeight}>
                <Text style={styles.logBtnText}>Log</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.subTitle, { marginTop: 16 }]}>Weight history</Text>
            {pig.weight_records?.length === 0 && <Text style={styles.empty}>No weight records yet.</Text>}
            {pig.weight_records?.map((w) => (
              <RecordCard key={w.id} title={w.weight_kg + " kg"} sub={w.recorded_at} extra={w.notes} />
            ))}
          </View>
        )}
 
        {tab === "breeding" && (
          <View>
            <Text style={styles.subTitle}>Breeding records</Text>
            {pig.breeding_records?.length === 0 && <Text style={styles.empty}>No breeding records.</Text>}
            {pig.breeding_records?.map((b) => (
              <RecordCard key={b.id}
                title={"Bred: " + b.breeding_date}
                sub={"Status: " + b.pregnancy_status}
                extra={b.expected_farrowing_date ? "Expected farrowing: " + b.expected_farrowing_date : ""} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
 
function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}
 
function RecordCard({ title, sub, extra }) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{title}</Text>
      {sub ? <Text style={styles.recordSub}>{sub}</Text> : null}
      {extra ? <Text style={styles.recordExtra}>{extra}</Text> : null}
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  header: {
    backgroundColor: "#fff", padding: 20,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7",
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#FBEAF0", justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 24, fontWeight: "700", color: "#D4537E" },
  pigName: { fontSize: 18, fontWeight: "700", color: "#2C2C2A" },
  pigMeta: { fontSize: 13, color: "#888780", marginTop: 2 },
  tabRow: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1D9E75" },
  tabText: { fontSize: 13, color: "#888780", fontWeight: "500" },
  tabTextActive: { color: "#1D9E75", fontWeight: "700" },
  content: { padding: 16 },
  subTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2A", marginBottom: 10 },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#E8E7E0",
  },
  infoLabel: { fontSize: 13, color: "#888780" },
  infoValue: { fontSize: 13, color: "#2C2C2A", fontWeight: "500", maxWidth: "60%", textAlign: "right" },
  recordCard: {
    backgroundColor: "#fff", borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: "#D3D1C7",
  },
  recordTitle: { fontSize: 14, fontWeight: "600", color: "#2C2C2A" },
  recordSub: { fontSize: 12, color: "#888780", marginTop: 2 },
  recordExtra: { fontSize: 12, color: "#5F5E5A", marginTop: 2 },
  weightRow: { flexDirection: "row", gap: 10 },
  weightInput: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10,
    padding: 12, fontSize: 15, borderWidth: 0.5, borderColor: "#D3D1C7", color: "#2C2C2A",
  },
  logBtn: { backgroundColor: "#1D9E75", borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" },
  logBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  empty: { fontSize: 13, color: "#B4B2A9", fontStyle: "italic" },
  deleteHeaderBtn: {
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#FCEBEB",
  borderRadius: 10,
  padding: 10,
  borderWidth: 0.5,
  borderColor: "#E24B4A",
  },
  deleteHeaderIcon: { fontSize: 20 },
  deleteHeaderText: { fontSize: 11, color: "#A32D2D", fontWeight: "600", marginTop: 2 },
});
