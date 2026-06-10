/**
 * frontend/src/screens/PigDetailScreen.js
 * All emojis replaced with PNG icons. No tintColor applied.
 */
import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, TextInput, Alert, Image,
} from "react-native";
import { api } from "../services/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { COLORS, RADIUS, SHADOW, STATUS_COLORS, STAGE_COLORS } from "../theme";

const ICONS = {
  pig:       require("../assets/icons/pig.png"),
  health:    require("../assets/icons/pill.png"),
  weight:    require("../assets/icons/analytics.png"),  // TODO: Replace with weight.png
  breeding:  require("../assets/icons/breeding.png"),
  audit:     require("../assets/icons/audit.png"),
  vaccine:   require("../assets/icons/vaccine.png"),
  pill:      require("../assets/icons/pill.png"),
  logout:    require("../assets/icons/logout.png"),     // trash placeholder
  forecast:  require("../assets/icons/forecast.png"),  // calendar placeholder
  analytics: require("../assets/icons/analytics.png"),
  pregnant:  require("../assets/icons/pregnant.png"),
};

const TABS = [
  { key: "info",     label: "Info",     icon: ICONS.audit    },
  { key: "health",   label: "Health",   icon: ICONS.health   },
  { key: "weight",   label: "Weight",   icon: ICONS.weight   },
  { key: "breeding", label: "Breeding", icon: ICONS.breeding },
];

export default function PigDetailScreen({ route, navigation }) {
  const { pig: initialPig } = route.params;
  const [pig,           setPig]          = useState(null);
  const [tab,           setTab]          = useState("info");
  const [loading,       setLoading]      = useState(true);
  const [weightInput,   setWeightInput]  = useState("");
  const [weightError,   setWeightError]  = useState(null);
  const [savingWeight,  setSavingWeight] = useState(false);
  const [vaxModal,      setVaxModal]     = useState(false);
  const [vaxForm,       setVaxForm]      = useState({ vaccine_name: "", next_due_date: "", administered_by: "" });
  const [vaxErrors,     setVaxErrors]    = useState({});
  const [savingVax,     setSavingVax]    = useState(false);
  const [showVaxDatePicker, setShowVaxDatePicker] = useState(false);

  async function load() {
    try {
      const data = await api.getPig(initialPig.id);
      setPig(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

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
    if (!weightInput.trim()) { setWeightError("Weight is required."); return; }
    if (isNaN(parseFloat(weightInput)) || parseFloat(weightInput) <= 0) {
      setWeightError("Enter a valid weight greater than 0.");
      return;
    }
    setWeightError(null);
    setSavingWeight(true);
    try {
      await api.logWeight(pig.id, {
        weight_kg:   weightInput,
        recorded_at: new Date().toISOString().split("T")[0],
      });
      setWeightInput("");
      Alert.alert("Saved", "Weight record saved.");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingWeight(false); }
  }

  function validateVax() {
    const e = {};
    if (!vaxForm.vaccine_name.trim()) {
      e.vaccine_name = "Vaccine name is required.";
    }
    if (!vaxForm.next_due_date.trim()) {
      e.next_due_date = "Due date is required.";
    } else {
      // Check the date is valid and not in the past
      const selected = new Date(vaxForm.next_due_date);
      const today    = new Date();
      today.setHours(0, 0, 0, 0);   // compare date only, not time
      if (isNaN(selected.getTime())) {
        e.next_due_date = "Invalid date. Use the date picker or format YYYY-MM-DD.";
      } else if (selected < today) {
        e.next_due_date = `Date cannot be in the past. You selected ${vaxForm.next_due_date}. Please choose today or a future date.`;
      }
    }
    setVaxErrors(e);
    return Object.keys(e).length === 0;
  }

  async function scheduleVaccination() {
    if (!validateVax()) return;
    setSavingVax(true);
    try {
      await api.scheduleVaccination(pig.id, {
        ...vaxForm,
        date_given: new Date().toISOString().split("T")[0],
      });
      Alert.alert("Scheduled", `${vaxForm.vaccine_name} has been scheduled.`);
      setVaxModal(false);
      setVaxForm({ vaccine_name: "", next_due_date: "", administered_by: "" });
      setVaxErrors({});
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingVax(false); }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  const status      = STATUS_COLORS[pig.health_status] || STATUS_COLORS.healthy;
  const stage       = STAGE_COLORS[pig.growth_stage]   || STAGE_COLORS.grower;
  const genderColor = pig.gender === "female" ? COLORS.pink : COLORS.blue;
  const genderLabel = pig.gender === "female" ? "Female" : "Male";

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.headerCard}>
        <View style={s.avatarWrap}>
          <Image source={ICONS.pig} style={{ width: 36, height: 36, resizeMode: "contain" }} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.pigName}>{pig.name}</Text>
            <View style={[s.genderBadge, { backgroundColor: genderColor + "33" }]}>
              <Text style={[s.genderBadgeText, { color: genderColor }]}>{genderLabel}</Text>
            </View>
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
          <Image source={ICONS.logout} style={{ width: 18, height: 18, resizeMode: "contain" }} />
        </TouchableOpacity>
      </View>

      {/* Quick stats */}
      <View style={s.statsRow}>
        <StatPill icon={ICONS.forecast} label="Age"          value={`${pig.age_in_months} mo`} />
        <StatPill icon={ICONS.weight}   label="Weight"       value={pig.latest_weight ? `${pig.latest_weight} kg` : "—"} />
        <StatPill icon={ICONS.health}   label="Last checkup" value={pig.last_checkup_date || "—"} />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}>
            <Image source={t.icon} style={[s.tabIcon, tab === t.key ? { opacity: 1 } : { opacity: 0.4 }]} />
            <Text style={[s.tabLabel, tab === t.key && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* INFO TAB */}
        {tab === "info" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Pig Information</Text>
            <InfoRow icon={ICONS.audit}     label="Pig ID"       value={pig.pig_id} />
            <InfoRow icon={ICONS.forecast}  label="Date of birth"value={pig.date_of_birth} />
            <InfoRow icon={ICONS.pig}       label="Breed"        value={pig.breed} />
            <InfoRow icon={ICONS.pig}       label="Gender"       value={pig.gender} />
            <InfoRow icon={ICONS.analytics} label="Growth stage" value={pig.growth_stage} />
            <InfoRow icon={ICONS.health}    label="Health status"value={pig.health_status.replace("_", " ")} />
            <InfoRow icon={ICONS.forecast}  label="Last checkup" value={pig.last_checkup_date || "Not recorded"} />
            {pig.notes ? <InfoRow icon={ICONS.audit} label="Notes" value={pig.notes} /> : null}
          </View>
        )}

        {/* HEALTH TAB */}
        {tab === "health" && (
          <>
            <TouchableOpacity style={s.primaryActionBtn}
              onPress={() => navigation.navigate("HealthLog", { pig })}>
              <Image source={ICONS.health} style={{ width: 20, height: 20, resizeMode: "contain" }} />
              <Text style={s.primaryActionText}>Log Health Check</Text>
              <Text style={s.primaryActionArrow}>→</Text>
            </TouchableOpacity>

            <View style={s.card}>
              <View style={s.cardHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Image source={ICONS.vaccine} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                  <Text style={s.cardTitle}>Vaccinations</Text>
                </View>
                <TouchableOpacity style={s.addSmallBtn} onPress={() => setVaxModal(true)}>
                  <Text style={s.addSmallBtnText}>+ Schedule</Text>
                </TouchableOpacity>
              </View>
              {pig.vaccinations?.length === 0
                ? <EmptyInCard text="No vaccinations recorded" />
                : pig.vaccinations?.map(v => (
                  <RecordRow key={v.id}
                    iconSource={ICONS.vaccine} iconBg="#EDE9FE"
                    title={v.vaccine_name}
                    sub={`Given: ${v.date_given}`}
                    extra={v.next_due_date ? `Due: ${v.next_due_date}` : ""} />
                ))}
            </View>

            <View style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Image source={ICONS.pill} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                <Text style={s.cardTitle}>Disease History</Text>
              </View>
              {pig.diseases?.length === 0
                ? <EmptyInCard text="No disease history" />
                : pig.diseases?.map(d => (
                  <RecordRow key={d.id}
                    iconSource={ICONS.pill} iconBg={COLORS.dangerBg}
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
                  <TouchableOpacity onPress={() => { setVaxModal(false); setVaxErrors({}); setShowVaxDatePicker(false); }}>
                    <Text style={s.modalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 20 }}>
                  <ModalField label="Vaccine name" required error={vaxErrors.vaccine_name}>
                    <TextInput style={[s.modalInput, vaxErrors.vaccine_name && s.modalInputError]}
                      value={vaxForm.vaccine_name}
                      onChangeText={v => { setVaxForm(f => ({ ...f, vaccine_name: v })); if (vaxErrors.vaccine_name) setVaxErrors(p => ({ ...p, vaccine_name: null })); }}
                      placeholder="e.g. Hog Cholera" placeholderTextColor={COLORS.textMuted} />
                  </ModalField>
                  <ModalField label="Due date" required error={vaxErrors.next_due_date}>
                    {/* DateTimePicker replaces the free-text TextInput.
                        minimumDate={new Date()} prevents selecting any past date.
                        The user cannot type a date — they only pick from the calendar.
                        This eliminates Problems 1, 2, and 3 at the UI layer. */}
                    <TouchableOpacity
                      style={[s.modalInput, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
                        vaxErrors.next_due_date && s.modalInputError]}
                      onPress={() => setShowVaxDatePicker(true)}
                    >
                      <Text style={{ fontSize: 14, color: vaxForm.next_due_date ? COLORS.textPrimary : COLORS.textMuted }}>
                        {vaxForm.next_due_date || "Tap to select a future date"}
                      </Text>
                      <Image source={ICONS.forecast} style={{ width: 16, height: 16, resizeMode: "contain", opacity: 0.5 }} />
                    </TouchableOpacity>
                    {showVaxDatePicker && (
                      <DateTimePicker
                        value={vaxForm.next_due_date ? new Date(vaxForm.next_due_date) : new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        minimumDate={new Date()}
                        onChange={(event, selectedDate) => {
                          setShowVaxDatePicker(Platform.OS === "ios");
                          if (selectedDate) {
                            const iso = selectedDate.toISOString().split("T")[0];
                            setVaxForm(f => ({ ...f, next_due_date: iso }));
                            if (vaxErrors.next_due_date) setVaxErrors(p => ({ ...p, next_due_date: null }));
                          }
                        }}
                      />
                    )}
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
              <View style={{ marginBottom: 4 }}>
                <Text style={s.fieldLabel}>Weight in kg<Text style={s.asterisk}> *</Text></Text>
                <View style={s.weightInputRow}>
                  <TextInput
                    style={[s.input, { flex: 1 }, weightError && { borderColor: "#E53935" }]}
                    placeholder="Enter weight in kg"
                    placeholderTextColor={COLORS.textMuted}
                    value={weightInput}
                    onChangeText={v => { setWeightInput(v); if (weightError) setWeightError(null); }}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity style={s.logWeightBtn} onPress={logWeight} disabled={savingWeight}>
                    {savingWeight
                      ? <ActivityIndicator color={COLORS.white} size="small" />
                      : <Text style={s.logWeightBtnText}>Log</Text>}
                  </TouchableOpacity>
                </View>
                {weightError ? <Text style={s.errorText}>{weightError}</Text> : null}
              </View>
            </View>

            <View style={s.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Image source={ICONS.weight} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                <Text style={s.cardTitle}>Weight History</Text>
              </View>
              {pig.weight_records?.length === 0
                ? <EmptyInCard text="No weight records yet" />
                : pig.weight_records?.map((w, i) => (
                  <RecordRow key={w.id}
                    iconSource={ICONS.weight} iconBg={COLORS.primaryLight}
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Image source={ICONS.breeding} style={{ width: 16, height: 16, resizeMode: "contain" }} />
              <Text style={s.cardTitle}>Breeding Records</Text>
            </View>
            {pig.breeding_records?.length === 0
              ? <EmptyInCard text="No breeding records" />
              : pig.breeding_records?.map((b, i) => (
                <RecordRow key={b.id}
                  iconSource={ICONS.pregnant} iconBg="#F3E8FF"
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }) {
  return (
    <View style={s.statPill}>
      <Image source={icon} style={{ width: 18, height: 18, resizeMode: "contain", marginBottom: 3 }} />
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <Image source={icon} style={{ width: 16, height: 16, resizeMode: "contain" }} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function RecordRow({ iconSource, iconBg, title, sub, extra, outcomeColor, isFirst }) {
  return (
    <View style={[s.recordRow, !isFirst && { borderTopWidth: 1, borderTopColor: COLORS.borderLight }]}>
      <View style={[s.recordIcon, { backgroundColor: iconBg }]}>
        <Image source={iconSource} style={{ width: 18, height: 18, resizeMode: "contain" }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.recordTitle}>{title}</Text>
        {sub   ? <Text style={s.recordSub}>{sub}</Text> : null}
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

function ModalField({ label, required, error, children }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.modalFieldLabel}>
        {label}
        {required && <Text style={{ color: "#E53935", fontWeight: "800" }}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg },

  headerCard:  { backgroundColor: COLORS.primary, padding: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  avatarWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  nameRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  pigName:     { fontSize: 20, fontWeight: "800", color: COLORS.white },
  genderBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  genderBadgeText: { fontSize: 11, fontWeight: "700" },
  pigMeta:     { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  badgeRow:    { flexDirection: "row", gap: 6, marginTop: 8 },
  stageBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  stageBadgeText: { fontSize: 11, fontWeight: "700" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  deleteBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  statsRow:  { flexDirection: "row", marginHorizontal: 16, gap: 8, paddingVertical: 12 },
  statPill:  { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 10, alignItems: "center", ...SHADOW.sm },
  statLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "500" },
  statValue: { fontSize: 12, color: COLORS.textPrimary, fontWeight: "700", marginTop: 2, textAlign: "center" },

  tabRow:       { flexDirection: "row", backgroundColor: COLORS.white, marginHorizontal: 16, borderRadius: RADIUS.xl, padding: 4, ...SHADOW.sm, marginBottom: 4 },
  tabBtn:       { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: RADIUS.lg, gap: 2 },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabIcon:      { width: 16, height: 16, resizeMode: "contain" },
  tabLabel:     { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  tabLabelActive:{ color: COLORS.white },

  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardTitle:    { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 12 },
  cardHeaderRow:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },

  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  asterisk:   { color: "#E53935", fontWeight: "800" },
  errorText:  { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },

  infoRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  infoLabel: { fontSize: 13, color: COLORS.textMuted, flex: 1 },
  infoValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "600", textAlign: "right", maxWidth: "55%", textTransform: "capitalize" },

  recordRow:   { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  recordIcon:  { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  recordTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  recordSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  recordExtra: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: "500" },

  weightInputRow:  { flexDirection: "row", gap: 10, alignItems: "center" },
  input:           { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  logWeightBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 20, paddingVertical: 13 },
  logWeightBtnText:{ color: COLORS.white, fontWeight: "700", fontSize: 14 },

  primaryActionBtn:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14 },
  primaryActionText: { flex: 1, color: COLORS.white, fontWeight: "700", fontSize: 14 },
  primaryActionArrow:{ color: "rgba(255,255,255,0.7)", fontSize: 16 },
  addSmallBtn:       { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  addSmallBtnText:   { fontSize: 12, color: COLORS.primary, fontWeight: "700" },

  emptyInCard:    { paddingVertical: 20, alignItems: "center" },
  emptyInCardText:{ fontSize: 13, color: COLORS.textMuted, fontStyle: "italic" },

  modal:           { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:      { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  modalClose:      { fontSize: 18, color: COLORS.textMuted, paddingHorizontal: 4 },
  modalInput:      { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  modalInputError: { borderColor: "#E53935", borderWidth: 1.5 },
  modalFieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  saveBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center", marginTop: 8 },
  saveBtnText:     { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});