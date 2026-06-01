import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, TextInput, Alert,
} from "react-native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW, STATUS_COLORS, STAGE_COLORS } from "../theme";

const TABS = [
  { key: "info",     label: "Info",     icon: "📋" },
  { key: "health",   label: "Health",   icon: "🩺" },
  { key: "weight",   label: "Weight",   icon: "⚖️" },
  { key: "breeding", label: "Breeding", icon: "🌸" },
];

export default function PigDetailScreen({ route, navigation }) {
  const initialPig = route?.params?.pig;
  const [pig, setPig]         = useState(null);
  const [tab, setTab]         = useState("info");
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [vaxModal, setVaxModal]   = useState(false);
  const [vaxForm, setVaxForm]     = useState({ vaccine_name: "", next_due_date: "", administered_by: "" });
  const [savingVax, setSavingVax] = useState(false);

  async function load() {
    try {
      const data = await api.getPig(initialPig.id);
      setPig(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (!initialPig) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Pig data not found.</Text>
      </View>
    );
  }

  async function handleDelete() {
    Alert.alert("Remove pig", `Are you sure you want to remove ${pig.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          await api.deletePig(pig.id);
          Alert.alert("Removed", `${pig.name} has been removed.`, [
            { text: "OK", onPress: () => navigation.goBack() },
          ]);
        } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  async function logWeight() {
    if (!weightInput) return;
    setSavingWeight(true);
    try {
      await api.logWeight(pig.id, {
        weight_kg: weightInput,
        recorded_at: new Date().toISOString().split("T")[0],
      });
      setWeightInput("");
      Alert.alert("Logged! ✅", "Weight record saved.");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingWeight(false); }
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
      Alert.alert("Scheduled! 💉", `${vaxForm.vaccine_name} has been scheduled.`);
      setVaxModal(false);
      setVaxForm({ vaccine_name: "", next_due_date: "", administered_by: "" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingVax(false); }
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const status  = STATUS_COLORS[pig.health_status] || STATUS_COLORS.healthy;
  const stage   = STAGE_COLORS[pig.growth_stage]   || STAGE_COLORS.grower;
  const genderColor = pig.gender === "female" ? COLORS.pink : COLORS.blue;

  return (
    <View style={s.screen}>
      {/* Header card */}
      <View style={s.headerCard}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarEmoji}>🐷</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.pigName}>{pig.name}</Text>
            <Text style={[s.genderBadge, { color: genderColor }]}>
              {pig.gender === "female" ? "♀" : "♂"}
            </Text>
          </View>
          <Text style={s.pigMeta}>{pig.pig_id}  •  {pig.breed}</Text>
          <View style={s.badgeRow}>
            <View style={[s.stageBadge, { backgroundColor: stage.bg }]}>
              <Text style={[s.stageBadgeText, { color: stage.text }]}>
                {pig.growth_stage.charAt(0).toUpperCase() + pig.growth_stage.slice(1)}
              </Text>
            </View>
            <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[s.statusDot, { backgroundColor: status.dot }]} />
              <Text style={[s.statusBadgeText, { color: status.text }]}>
                {pig.health_status === "under_treatment" ? "Under Obs." :
                 pig.health_status.charAt(0).toUpperCase() + pig.health_status.slice(1)}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
          <Text style={s.deleteBtnIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* Quick stats */}
      <View style={s.statsRow}>
        <StatPill icon="📅" label="Age" value={`${pig.age_in_months} mo`} />
        <StatPill icon="⚖️" label="Weight" value={pig.latest_weight ? `${pig.latest_weight} kg` : "—"} />
        <StatPill icon="🩺" label="Last checkup" value={pig.last_checkup_date || "—"} />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[s.tabIcon]}>{t.icon}</Text>
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* INFO TAB */}
        {tab === "info" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Pig Information</Text>
            <InfoRow icon="🏷️" label="Pig ID"       value={pig.pig_id} />
            <InfoRow icon="📅" label="Date of birth" value={pig.date_of_birth} />
            <InfoRow icon="🔬" label="Breed"         value={pig.breed} />
            <InfoRow icon="⚧"  label="Gender"        value={pig.gender} />
            <InfoRow icon="📈" label="Growth stage"  value={pig.growth_stage} />
            <InfoRow icon="🩺" label="Health status" value={pig.health_status.replace("_", " ")} />
            <InfoRow icon="📆" label="Last checkup"  value={pig.last_checkup_date || "Not recorded"} />
            {pig.notes ? <InfoRow icon="📝" label="Notes" value={pig.notes} /> : null}
          </View>
        )}

        {/* HEALTH TAB */}
        {tab === "health" && (
          <>
            <TouchableOpacity style={s.primaryActionBtn}
              onPress={() => navigation.navigate("HealthLog", { pig })}>
              <Text style={s.primaryActionIcon}>🩺</Text>
              <Text style={s.primaryActionText}>Log Health Check</Text>
              <Text style={s.primaryActionArrow}>→</Text>
            </TouchableOpacity>

            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <Text style={s.cardTitle}>💉 Vaccinations</Text>
                <TouchableOpacity style={s.addSmallBtn} onPress={() => setVaxModal(true)}>
                  <Text style={s.addSmallBtnText}>+ Schedule</Text>
                </TouchableOpacity>
              </View>
              {pig.vaccinations?.length === 0
                ? <EmptyInCard text="No vaccinations recorded" />
                : pig.vaccinations?.map(v => (
                  <RecordRow key={v.id}
                    icon="💉" iconBg="#EDE9FE"
                    title={v.vaccine_name}
                    sub={`Given: ${v.date_given}`}
                    extra={v.next_due_date ? `Due: ${v.next_due_date}` : ""} />
                ))}
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>🦠 Disease History</Text>
              {pig.diseases?.length === 0
                ? <EmptyInCard text="No disease history" />
                : pig.diseases?.map(d => (
                  <RecordRow key={d.id}
                    icon="🦠" iconBg={COLORS.dangerBg}
                    title={d.disease_name}
                    sub={`Diagnosed: ${d.diagnosed_date}`}
                    extra={`Outcome: ${d.outcome}`}
                    outcomeColor={d.outcome === "recovered" ? COLORS.healthy : d.outcome === "ongoing" ? COLORS.warning : COLORS.danger} />
                ))}
            </View>

            {/* Vaccination modal */}
            <Modal visible={vaxModal} animationType="slide" presentationStyle="pageSheet">
              <View style={s.modal}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Schedule Vaccination</Text>
                  <TouchableOpacity onPress={() => setVaxModal(false)}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 20 }}>
                  <ModalField label="Vaccine name *">
                    <TextInput style={s.modalInput} value={vaxForm.vaccine_name}
                      onChangeText={v => setVaxForm(f => ({ ...f, vaccine_name: v }))}
                      placeholder="e.g. Hog Cholera" placeholderTextColor={COLORS.textMuted} />
                  </ModalField>
                  <ModalField label="Due date * (YYYY-MM-DD)">
                    <TextInput style={s.modalInput} value={vaxForm.next_due_date}
                      onChangeText={v => setVaxForm(f => ({ ...f, next_due_date: v }))}
                      placeholder="e.g. 2025-06-15" placeholderTextColor={COLORS.textMuted} />
                  </ModalField>
                  <ModalField label="Veterinarian (optional)">
                    <TextInput style={s.modalInput} value={vaxForm.administered_by}
                      onChangeText={v => setVaxForm(f => ({ ...f, administered_by: v }))}
                      placeholder="e.g. Dr. Santos" placeholderTextColor={COLORS.textMuted} />
                  </ModalField>
                  <TouchableOpacity style={s.saveBtn} onPress={scheduleVaccination} disabled={savingVax}>
                    {savingVax
                      ? <ActivityIndicator color={COLORS.white} />
                      : <Text style={s.saveBtnText}>Save Schedule</Text>}
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </Modal>
          </>
        )}

        {/* WEIGHT TAB */}
        {tab === "weight" && (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Log New Weight</Text>
              <View style={s.weightInputRow}>
                <TextInput style={[s.input, { flex: 1 }]}
                  placeholder="Enter weight in kg" placeholderTextColor={COLORS.textMuted}
                  value={weightInput} onChangeText={setWeightInput}
                  keyboardType="decimal-pad" />
                <TouchableOpacity style={s.logWeightBtn} onPress={logWeight} disabled={savingWeight}>
                  {savingWeight
                    ? <ActivityIndicator color={COLORS.white} size="small" />
                    : <Text style={s.logWeightBtnText}>Log</Text>}
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>⚖️ Weight History</Text>
              {pig.weight_records?.length === 0
                ? <EmptyInCard text="No weight records yet" />
                : pig.weight_records?.map((w, i) => (
                  <RecordRow key={w.id}
                    icon="⚖️" iconBg={COLORS.primaryLight}
                    title={`${w.weight_kg} kg`}
                    sub={w.recorded_at}
                    extra={w.notes || ""}
                    isFirst={i === 0} />
                ))}
            </View>
          </>
        )}

        {/* BREEDING TAB */}
        {tab === "breeding" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🌸 Breeding Records</Text>
            {pig.breeding_records?.length === 0
              ? <EmptyInCard text="No breeding records" />
              : pig.breeding_records?.map((b, i) => (
                <RecordRow key={b.id}
                  icon="🌸" iconBg="#F3E8FF"
                  title={`Bred: ${b.breeding_date}`}
                  sub={`Status: ${b.pregnancy_status}`}
                  extra={b.expected_farrowing_date ? `Expected farrowing: ${b.expected_farrowing_date}` : ""}
                  outcomeColor={b.pregnancy_status === "farrowed" ? COLORS.healthy : b.pregnancy_status === "pregnant" ? COLORS.blue : COLORS.warning} />
              ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatPill({ icon, label, value }) {
  return (
    <View style={s.statPill}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function RecordRow({ icon, iconBg, title, sub, extra, outcomeColor, isFirst }) {
  return (
    <View style={[s.recordRow, !isFirst && { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]}>
      <View style={[s.recordIcon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.recordTitle}>{title}</Text>
        {sub ? <Text style={s.recordSub}>{sub}</Text> : null}
        {extra ? <Text style={[s.recordExtra, outcomeColor && { color: outcomeColor }]}>{extra}</Text> : null}
      </View>
    </View>
  );
}

function EmptyInCard({ text }) {
  return (
    <View style={s.emptyInCard}>
      <Text style={s.emptyInCardText}>{text}</Text>
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

  // Header
  headerCard:  { backgroundColor: COLORS.primary, padding: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  avatarEmoji: { fontSize: 36 },
  nameRow:     { flexDirection: "row", alignItems: "center", gap: 6 },
  pigName:     { fontSize: 20, fontWeight: "800", color: COLORS.white },
  genderBadge: { fontSize: 18, fontWeight: "800" },
  pigMeta:     { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  badgeRow:    { flexDirection: "row", gap: 6, marginTop: 8 },
  stageBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  stageBadgeText:{ fontSize: 11, fontWeight: "700" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText:{ fontSize: 11, fontWeight: "700" },
  deleteBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  deleteBtnIcon:{ fontSize: 16 },

  // Stats
  statsRow:  { flexDirection: "row", marginHorizontal: 16, marginTop: -1, gap: 8, marginBottom: 4, paddingVertical: 12 },
  statPill:  { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 10, alignItems: "center", ...SHADOW.sm },
  statIcon:  { fontSize: 18, marginBottom: 3 },
  statLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "500" },
  statValue: { fontSize: 12, color: COLORS.textPrimary, fontWeight: "700", marginTop: 2, textAlign: "center" },

  // Tabs
  tabRow: { flexDirection: "row", backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: RADIUS.xl, padding: 4, ...SHADOW.sm, marginBottom: 4, overflow: "hidden" },
  tabBtn:     { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: RADIUS.lg, gap: 2 },
  tabBtnActive:{ backgroundColor: COLORS.primary },
  tabIcon:    { fontSize: 14 },
  tabLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  tabLabelActive:{ color: COLORS.white },

  // Cards
  card:        { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardTitle:   { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 12 },
  cardHeaderRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },

  // Info rows
  infoRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  infoIcon:  { fontSize: 16, width: 24, textAlign: "center" },
  infoLabel: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600", textAlign: "right", maxWidth: "55%", textTransform: "capitalize" },

  // Record rows
  recordRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  recordIcon:  { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  recordTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  recordSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  recordExtra: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },

  // Weight
  weightInputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input:          { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  logWeightBtn:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 13 },
  logWeightBtnText:{ color: COLORS.white, fontWeight: "700", fontSize: 14 },

  // Action buttons
  primaryActionBtn:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14 },
  primaryActionIcon: { fontSize: 20 },
  primaryActionText: { flex: 1, color: COLORS.white, fontWeight: "700", fontSize: 14 },
  primaryActionArrow:{ color: "rgba(255,255,255,0.7)", fontSize: 16 },
  addSmallBtn:       { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  addSmallBtnText:   { fontSize: 12, color: COLORS.primary, fontWeight: "700" },

  emptyInCard:    { paddingVertical: 20, alignItems: "center" },
  emptyInCardText:{ fontSize: 13, color: COLORS.textMuted, fontStyle: "italic" },

  // Modal
  modal:          { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  modalClose:     { fontSize: 18, color: COLORS.textMuted },
  modalInput:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  modalFieldLabel:{ fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  saveBtn:        { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center", marginTop: 8 },
  saveBtnText:    { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});