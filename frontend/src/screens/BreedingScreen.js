/**
 * frontend/src/screens/BreedingScreen.js
 *
 * Redesign applied:
 *  1. Sow selection uses a picker loaded from GET /breeding/eligible_sows/
 *     No manual ID typing. Displays pig_id + name. Stores internal pig ID.
 *  2. Breeding date uses DateTimePicker — no free-text date entry.
 *  3. Failed breeding is a first-class outcome with a "Mark as Failed" action.
 *     Failed attempts count in pregnancy_success_rate analytics.
 *  4. Farrowing modal now collects piglets_weaned + wean_date, which feed
 *     directly into weaning_rate_pct in breeding_analytics.
 *  5. Metric cards call the real backend breeding_analytics endpoint so
 *     success % is computed server-side using all records + baseline.
 *  6. All emojis replaced with PNG icons. No tintColor.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Modal,
  TextInput, Alert, Image, Platform, FlatList,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const ICONS = {
  pig:       require("../assets/icons/pig.png"),
  pregnant:  require("../assets/icons/pregnant.png"),
  farrowed:  require("../assets/icons/forrowed.png"),
  breeding:  require("../assets/icons/breeding.png"),
  analytics: require("../assets/icons/analytics.png"),
  alert:     require("../assets/icons/bell.png"),
  forecast:  require("../assets/icons/forecast.png"),
  feeds:     require("../assets/icons/feeds.png"),
};

const STATUS_CONFIG = {
  pregnant: { bg: COLORS.blueBg,      text: COLORS.blue,     icon: "pregnant", label: "Pregnant" },
  farrowed: { bg: COLORS.healthyBg,   text: COLORS.healthy,  icon: "farrowed", label: "Farrowed" },
  bred:     { bg: "#F3E8FF",           text: "#9333EA",       icon: "breeding", label: "Bred"     },
  open:     { bg: COLORS.screenBg,    text: COLORS.textMuted, icon: "pig",     label: "Open"     },
  failed:   { bg: COLORS.dangerBg,    text: COLORS.danger,   icon: "alert",   label: "Failed"   },
};

// Required field label with red asterisk
function RL({ text }) {
  return (
    <Text style={s.fieldLabel}>
      {text}<Text style={{ color: "#E53935", fontWeight: "800" }}> *</Text>
    </Text>
  );
}

// DatePicker button — replaces every date TextInput
function DateBtn({ label, required, value, onChange, error, maxDate }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value) : new Date();
  function handle(event, selected) {
    setShow(Platform.OS === "ios");
    if (selected) onChange(selected.toISOString().split("T")[0]);
  }
  return (
    <View style={{ marginBottom: 14 }}>
      {required ? <RL text={label} /> : <Text style={s.fieldLabel}>{label}</Text>}
      <TouchableOpacity
        style={[s.dateBtn, error && s.dateBtnError]}
        onPress={() => setShow(true)}>
        <Text style={{ fontSize: 14, color: value ? COLORS.textPrimary : COLORS.textMuted }}>
          {value || "Tap to select date"}
        </Text>
        <Image source={ICONS.forecast} style={{ width: 14, height: 14, resizeMode: "contain", opacity: 0.5 }} />
      </TouchableOpacity>
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handle}
          maximumDate={maxDate || new Date()}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function BreedingScreen() {
  const { farmId } = useAuth();

  const [records,       setRecords]      = useState([]);
  const [analytics,     setAnalytics]    = useState(null);
  const [eligibleSows,  setEligibleSows] = useState([]);
  const [loading,       setLoading]      = useState(true);

  // ── Add Record Modal state ────────────────────────────────────────────────
  const [showModal,      setShowModal]      = useState(false);
  const [showSowPicker,  setShowSowPicker]  = useState(false);
  const [form,           setForm]           = useState({
    sow_id: null, sow_label: "", breeding_date: "", notes: "",
  });
  const [formErrors,  setFormErrors]  = useState({});
  const [saving,      setSaving]      = useState(false);

  // ── Farrowing Modal state ─────────────────────────────────────────────────
  const [farrowModal,   setFarrowModal]   = useState(false);
  const [farrowRecord,  setFarrowRecord]  = useState(null);
  const [farrow,        setFarrow]        = useState({
    alive: "", dead: "", weaned: "", wean_date: "", notes: "",
  });
  const [farrowErrors,  setFarrowErrors]  = useState({});
  const [savingFarrow,  setSavingFarrow]  = useState(false);

  // ── Failed Modal state ────────────────────────────────────────────────────
  const [failedModal,   setFailedModal]   = useState(false);
  const [failedRecord,  setFailedRecord]  = useState(null);
  const [failedNotes,   setFailedNotes]   = useState("");
  const [savingFailed,  setSavingFailed]  = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  async function load() {
    try {
      const [br, sows] = await Promise.all([
        api.getBreeding(),
        api.getEligibleSows(),
      ]);
      setRecords(br.results || br);
      setEligibleSows(sows);

      // Load server-side breeding analytics for accurate KPIs
      if (farmId) {
        const bAnalytics = await api.getBreedingAnalytics(farmId);
        setAnalytics(bAnalytics);
      }
    } catch (e) { console.error("BreedingScreen load:", e.message); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, [farmId]));

  // ── Validate new breeding record ──────────────────────────────────────────
  function validateAdd() {
    const e = {};
    if (!form.sow_id)           e.sow          = "Please select a sow.";
    if (!form.breeding_date)    e.breeding_date = "Breeding date is required.";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit new breeding record ────────────────────────────────────────────
  async function handleAdd() {
    if (!validateAdd()) return;
    setSaving(true);
    try {
      await api.addBreeding({
        sow:           form.sow_id,
        breeding_date: form.breeding_date,
        notes:         form.notes,
      });
      setShowModal(false);
      resetAddForm();
      Alert.alert("Saved", "Breeding record added. Expected farrowing date calculated automatically.");
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  function resetAddForm() {
    setForm({ sow_id: null, sow_label: "", breeding_date: "", notes: "" });
    setFormErrors({});
  }

  // ── Validate farrowing ────────────────────────────────────────────────────
  function validateFarrow() {
    const e = {};
    if (!farrow.alive.trim()) e.alive = "Number of live piglets is required.";
    else if (isNaN(parseInt(farrow.alive)) || parseInt(farrow.alive) < 0)
      e.alive = "Enter a valid number (0 or more).";
    setFarrowErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit farrowing ──────────────────────────────────────────────────────
  async function submitFarrowing() {
    if (!validateFarrow()) return;
    setSavingFarrow(true);
    try {
      await api.recordFarrowing(farrowRecord.id, {
        piglets_born_alive: parseInt(farrow.alive),
        piglets_born_dead:  parseInt(farrow.dead  || "0"),
        piglets_weaned:     farrow.weaned ? parseInt(farrow.weaned) : undefined,
        wean_date:          farrow.wean_date || undefined,
        notes:              farrow.notes,
      });
      setFarrowModal(false);
      setFarrow({ alive: "", dead: "", weaned: "", wean_date: "", notes: "" });
      Alert.alert(
        "Farrowing Recorded",
        `Saved for ${farrowRecord.sow_name}. Analytics have been updated.`
      );
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingFarrow(false); }
  }

  // ── Submit failed ─────────────────────────────────────────────────────────
  async function submitFailed() {
    setSavingFailed(true);
    try {
      await api.markBreedingFailed(failedRecord.id, { notes: failedNotes });
      setFailedModal(false);
      setFailedNotes("");
      Alert.alert(
        "Recorded as Failed",
        "The failed breeding attempt has been recorded and included in reproductive analytics."
      );
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSavingFailed(false); }
  }

  // ── Status updates ────────────────────────────────────────────────────────
  async function markPregnant(id) {
    try {
      await api.updateBreeding(id, { pregnancy_status: "pregnant" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KPIs — from server analytics (includes baseline litters)
  // ─────────────────────────────────────────────────────────────────────────
  const pregnant     = records.filter(r => r.pregnancy_status === "pregnant").length;
  const farrowed_n   = records.filter(r => r.pregnancy_status === "farrowed").length;
  const failed_n     = records.filter(r => r.pregnancy_status === "failed").length;

  // Use server-computed analytics if available, fall back to client counts
  const pregnancyRate  = analytics?.pregnancy_success_rate_pct ?? (
    records.length > 0 ? Math.round(((pregnant + farrowed_n) / records.length) * 100) : 0
  );
  const avgLitter      = analytics?.avg_litter_size ?? "—";
  const baselineLitters= analytics?.baseline_litters ?? 0;

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>

        {/* KPI row — server-computed values */}
        <View style={s.metricsRow}>
          <MetricCard icon={ICONS.pregnant}  label="Pregnant"     value={pregnant}          color={COLORS.blue}    bg={COLORS.blueBg} />
          <MetricCard icon={ICONS.farrowed}  label="Farrowed"     value={farrowed_n}         color={COLORS.healthy} bg={COLORS.healthyBg} />
          <MetricCard icon={ICONS.analytics} label="Success Rate" value={`${pregnancyRate}%`} color={COLORS.primary} bg={COLORS.primaryLight} />
          <MetricCard icon={ICONS.alert}     label="Failed"       value={failed_n}            color={COLORS.danger}  bg={COLORS.dangerBg} />
        </View>

        {/* Secondary KPIs from server */}
        {analytics && (
          <View style={s.kpiRow}>
            <KpiPill label="Avg Litter"   value={avgLitter}                                color={COLORS.pink}   />
            <KpiPill label="Survival"     value={`${analytics.survival_rate_pct ?? "—"}%`} color={COLORS.healthy}/>
            <KpiPill label="Weaning Rate" value={`${analytics.weaning_rate_pct  ?? "—"}%`} color={COLORS.blue}   />
            <KpiPill label="Farrowing %"  value={`${analytics.farrowing_success_rate_pct ?? "—"}%`} color={COLORS.purple}/>
          </View>
        )}

        {/* Baseline notice */}
        {baselineLitters > 0 && (
          <View style={s.baselineNotice}>
            <Image source={ICONS.analytics} style={{ width: 14, height: 14, resizeMode: "contain" }} />
            <Text style={s.baselineText}>
              Includes {baselineLitters} historical litters from onboarding. Analytics reflect full breeding history.
            </Text>
          </View>
        )}

        <Text style={s.sectionTitle}>Breeding Records</Text>

        {records.length === 0 && (
          <View style={s.emptyState}>
            <Image source={ICONS.breeding} style={{ width: 52, height: 52, resizeMode: "contain", opacity: 0.4, marginBottom: 8 }} />
            <Text style={s.emptyTitle}>No breeding records</Text>
            <Text style={s.emptySub}>Tap the button below to add a record</Text>
          </View>
        )}

        {records.map(r => {
          const cfg      = STATUS_CONFIG[r.pregnancy_status] || STATUS_CONFIG.bred;
          const iconSrc  = ICONS[cfg.icon] || ICONS.breeding;
          const daysLeft = r.expected_farrowing_date
            ? Math.max(0, Math.round((new Date(r.expected_farrowing_date) - new Date()) / 86400000))
            : null;
          const isUrgent = daysLeft !== null && daysLeft <= 5;

          return (
            <View key={r.id} style={[s.card, isUrgent && s.cardUrgent, r.pregnancy_status === "failed" && s.cardFailed]}>
              <View style={s.cardHeader}>
                <View style={[s.statusIcon, { backgroundColor: cfg.bg }]}>
                  <Image source={iconSrc} style={{ width: 24, height: 24, resizeMode: "contain" }} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.sowName}>{r.sow_name}</Text>
                    {r.sow_pig_id && <Text style={s.sowId}>{r.sow_pig_id}</Text>}
                  </View>
                  <Text style={s.breedDate}>Bred: {r.breeding_date}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              </View>

              {r.expected_farrowing_date && r.pregnancy_status !== "failed" && (
                <View style={[s.farrowRow, isUrgent && s.farrowRowUrgent]}>
                  <Text style={s.farrowLabel}>Expected farrowing</Text>
                  <Text style={[s.farrowValue, isUrgent && { color: COLORS.danger, fontWeight: "700" }]}>
                    {r.expected_farrowing_date}
                    {daysLeft !== null ? ` (${daysLeft}d)` : ""}
                    {isUrgent ? " !" : ""}
                  </Text>
                </View>
              )}

              {/* Farrowing outcome */}
              {r.piglets_born_alive !== null && r.piglets_born_alive !== undefined && (
                <View style={s.pigletsRow}>
                  <View style={s.pigletBadge}>
                    <Image source={ICONS.farrowed} style={{ width: 12, height: 12, resizeMode: "contain", marginRight: 4 }} />
                    <Text style={s.pigletBadgeText}>{r.piglets_born_alive} live</Text>
                  </View>
                  {r.piglets_born_dead > 0 && (
                    <View style={[s.pigletBadge, { backgroundColor: COLORS.dangerBg }]}>
                      <Text style={[s.pigletBadgeText, { color: COLORS.danger }]}>{r.piglets_born_dead} dead</Text>
                    </View>
                  )}
                  {r.piglets_weaned != null && (
                    <View style={[s.pigletBadge, { backgroundColor: COLORS.blueBg }]}>
                      <Text style={[s.pigletBadgeText, { color: COLORS.blue }]}>{r.piglets_weaned} weaned</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Action buttons — only for active/non-terminal statuses */}
              {r.pregnancy_status === "bred" && (
                <View style={s.actionBtns}>
                  <TouchableOpacity style={s.actionBtn} onPress={() => markPregnant(r.id)}>
                    <Image source={ICONS.pregnant} style={{ width: 14, height: 14, resizeMode: "contain", marginRight: 5 }} />
                    <Text style={s.actionBtnText}>Mark Pregnant</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]}
                    onPress={() => { setFailedRecord(r); setFailedNotes(""); setFailedModal(true); }}>
                    <Image source={ICONS.alert} style={{ width: 14, height: 14, resizeMode: "contain", marginRight: 5 }} />
                    <Text style={[s.actionBtnText, { color: COLORS.danger }]}>Mark Failed</Text>
                  </TouchableOpacity>
                </View>
              )}

              {r.pregnancy_status === "pregnant" && (
                <View style={s.actionBtns}>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnGreen]}
                    onPress={() => { setFarrowRecord(r); setFarrow({ alive:"",dead:"",weaned:"",wean_date:"",notes:""}); setFarrowErrors({}); setFarrowModal(true); }}>
                    <Image source={ICONS.farrowed} style={{ width: 14, height: 14, resizeMode: "contain", marginRight: 5 }} />
                    <Text style={[s.actionBtnText, { color: COLORS.primary }]}>Record Farrowing</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]}
                    onPress={() => { setFailedRecord(r); setFailedNotes(""); setFailedModal(true); }}>
                    <Image source={ICONS.alert} style={{ width: 14, height: 14, resizeMode: "contain", marginRight: 5 }} />
                    <Text style={[s.actionBtnText, { color: COLORS.danger }]}>Mark Failed</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Farrowed but no weaning data yet */}
              {r.pregnancy_status === "farrowed" && r.piglets_weaned == null && (
                <TouchableOpacity style={[s.actionBtn, { marginTop: 8 }]}
                  onPress={() => { setFarrowRecord(r); setFarrow({ alive: String(r.piglets_born_alive||""), dead: String(r.piglets_born_dead||""), weaned:"", wean_date:"", notes:""}); setFarrowErrors({}); setFarrowModal(true); }}>
                  <Image source={ICONS.feeds} style={{ width: 14, height: 14, resizeMode: "contain", marginRight: 5 }} />
                  <Text style={s.actionBtnText}>Log Weaning Data</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => { resetAddForm(); setShowModal(true); }}>
        <Text style={s.fabText}>+ Add Record</Text>
      </TouchableOpacity>

      {/* ── ADD RECORD MODAL ──────────────────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => { setShowModal(false); resetAddForm(); }}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>New Breeding Record</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetAddForm(); }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>

            {/* Sow picker */}
            <RL text="Select sow" />
            <TouchableOpacity
              style={[s.pickerBtn, formErrors.sow && s.pickerBtnError]}
              onPress={() => setShowSowPicker(true)}>
              <View style={{ flex: 1 }}>
                {form.sow_label ? (
                  <Text style={{ fontSize: 14, color: COLORS.textPrimary, fontWeight: "600" }}>
                    {form.sow_label}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 14, color: COLORS.textMuted }}>
                    {eligibleSows.length === 0
                      ? "No eligible sows — add breeder/gilt pigs first"
                      : "Tap to select sow…"}
                  </Text>
                )}
              </View>
              <Image source={ICONS.pig} style={{ width: 16, height: 16, resizeMode: "contain", opacity: 0.5 }} />
            </TouchableOpacity>
            {formErrors.sow ? <Text style={s.errorText}>{formErrors.sow}</Text> : null}

            {/* Currently pregnant warning */}
            {form.sow_id && (() => {
              const selected = eligibleSows.find(s => s.id === form.sow_id);
              if (selected?.current_status === "pregnant") {
                return (
                  <View style={s.warnBox}>
                    <Image source={ICONS.alert} style={{ width: 14, height: 14, resizeMode: "contain" }} />
                    <Text style={s.warnText}>This sow has an active pregnancy record.</Text>
                  </View>
                );
              }
              return null;
            })()}

            {/* Breeding date picker */}
            <View style={{ marginTop: 14 }}>
              <DateBtn label="Breeding date" required
                value={form.breeding_date}
                onChange={v => { setForm(f => ({ ...f, breeding_date: v })); if (formErrors.breeding_date) setFormErrors(p => ({ ...p, breeding_date: null })); }}
                error={formErrors.breeding_date} />
            </View>

            <Text style={s.fieldLabel}>Notes (optional)</Text>
            <TextInput style={[s.modalInput, { height: 70, textAlignVertical: "top" }]}
              value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Any observations..." placeholderTextColor={COLORS.textMuted} multiline />

            <View style={s.infoBox}>
              <Text style={s.infoBoxText}>
                Expected farrowing date (114 days) is calculated automatically on the server.
              </Text>
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.saveBtnText}>Save Record</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── SOW PICKER MODAL ─────────────────────────────────────────────── */}
      <Modal visible={showSowPicker} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => setShowSowPicker(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Sow</Text>
            <TouchableOpacity onPress={() => setShowSowPicker(false)}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          {eligibleSows.length === 0 ? (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Image source={ICONS.pig} style={{ width: 40, height: 40, resizeMode: "contain", opacity: 0.4, marginBottom: 12 }} />
              <Text style={{ fontSize: 14, color: COLORS.textMuted, textAlign: "center" }}>
                No eligible sows found.{"\n"}Add female pigs with stage "Finisher" or "Breeder" first.
              </Text>
            </View>
          ) : (
            <FlatList
              data={eligibleSows}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              renderItem={({ item }) => {
                const isSelected = form.sow_id === item.id;
                const statusCfg  = STATUS_CONFIG[item.current_status] || STATUS_CONFIG.open;
                return (
                  <TouchableOpacity
                    style={[s.sowOption, isSelected && s.sowOptionActive]}
                    onPress={() => {
                      setForm(f => ({ ...f, sow_id: item.id, sow_label: item.display_label }));
                      if (formErrors.sow) setFormErrors(p => ({ ...p, sow: null }));
                      setShowSowPicker(false);
                    }}>
                    <View style={s.sowOptionAvatar}>
                      <Image source={ICONS.pig} style={{ width: 22, height: 22, resizeMode: "contain" }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={s.sowOptionName}>{item.name}</Text>
                        <Text style={s.sowOptionId}>{item.pig_id}</Text>
                      </View>
                      <Text style={s.sowOptionMeta}>
                        {item.breed}  ·  {item.growth_stage}
                        {item.age_in_months ? `  ·  ${item.age_in_months} mo` : ""}
                        {item.latest_weight ? `  ·  ${item.latest_weight} kg` : ""}
                      </Text>
                      {item.last_bred && (
                        <Text style={s.sowOptionMeta}>Last bred: {item.last_bred}</Text>
                      )}
                    </View>
                    <View style={[s.sowStatusChip, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[s.sowStatusText, { color: statusCfg.text }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── FARROWING MODAL ──────────────────────────────────────────────── */}
      <Modal visible={farrowModal} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => setFarrowModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {farrowRecord?.piglets_born_alive != null ? "Update Weaning Data" : "Record Farrowing"} — {farrowRecord?.sow_name}
            </Text>
            <TouchableOpacity onPress={() => setFarrowModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>

            {/* Live piglets */}
            <RL text="Live piglets born" />
            <TextInput style={[s.modalInput, farrowErrors.alive && s.modalInputError]}
              value={farrow.alive}
              onChangeText={v => { setFarrow(f => ({ ...f, alive: v })); if (farrowErrors.alive) setFarrowErrors({}); }}
              placeholder="e.g. 10" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
            {farrowErrors.alive ? <Text style={s.errorText}>{farrowErrors.alive}</Text> : null}

            {/* Dead piglets */}
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Dead piglets born</Text>
            <TextInput style={s.modalInput} value={farrow.dead}
              onChangeText={v => setFarrow(f => ({ ...f, dead: v }))}
              placeholder="e.g. 1 (0 if none)" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />

            {/* Weaning data — feeds weaning_rate_pct analytics */}
            <View style={s.weaningSection}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Image source={ICONS.feeds} style={{ width: 14, height: 14, resizeMode: "contain" }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.primary }}>
                  Weaning Data (optional — updates weaning rate analytics)
                </Text>
              </View>
              <Text style={s.weaningHint}>
                Leave blank now if piglets haven't been weaned yet. You can update this later.
              </Text>

              <Text style={[s.fieldLabel, { marginTop: 8 }]}>Piglets weaned</Text>
              <TextInput style={s.modalInput} value={farrow.weaned}
                onChangeText={v => setFarrow(f => ({ ...f, weaned: v }))}
                placeholder="e.g. 9" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />

              <View style={{ marginTop: 10 }}>
                <DateBtn label="Wean date" value={farrow.wean_date}
                  onChange={v => setFarrow(f => ({ ...f, wean_date: v }))}
                  maxDate={new Date(Date.now() + 86400000 * 30)} />
              </View>
            </View>

            <Text style={[s.fieldLabel, { marginTop: 4 }]}>Notes (optional)</Text>
            <TextInput style={[s.modalInput, { height: 70, textAlignVertical: "top" }]}
              value={farrow.notes} onChangeText={v => setFarrow(f => ({ ...f, notes: v }))}
              placeholder="Any observations during delivery..." placeholderTextColor={COLORS.textMuted} multiline />

            <TouchableOpacity style={s.saveBtn} onPress={submitFarrowing} disabled={savingFarrow}>
              {savingFarrow ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.saveBtnText}>Save Farrowing Record</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── MARK FAILED MODAL ────────────────────────────────────────────── */}
      <Modal visible={failedModal} animationType="slide" presentationStyle="formSheet"
          onRequestClose={() => setFailedModal(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Mark as Failed — {failedRecord?.sow_name}</Text>
            <TouchableOpacity onPress={() => setFailedModal(false)}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <View style={s.failedInfoBox}>
              <Image source={ICONS.analytics} style={{ width: 16, height: 16, resizeMode: "contain" }} />
              <Text style={s.failedInfoText}>
                Recording this as a failed breeding attempt is important.
                It will be counted in pregnancy success rate calculations
                so your reproductive analytics remain accurate.
              </Text>
            </View>
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Reason / notes (optional)</Text>
            <TextInput style={[s.modalInput, { height: 80, textAlignVertical: "top" }]}
              value={failedNotes} onChangeText={setFailedNotes}
              placeholder="e.g. No pregnancy detected at 30-day check, sow returned to estrus"
              placeholderTextColor={COLORS.textMuted} multiline />
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: COLORS.danger }]}
              onPress={submitFailed} disabled={savingFailed}>
              {savingFailed ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.saveBtnText}>Confirm Failed Attempt</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.metricCard, { backgroundColor: bg }]}>
      <Image source={icon} style={{ width: 24, height: 24, resizeMode: "contain", marginBottom: 6 }} />
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

function KpiPill({ label, value, color }) {
  return (
    <View style={s.kpiPill}>
      <Text style={[s.kpiPillValue, { color }]}>{value}</Text>
      <Text style={s.kpiPillLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  metricsRow:  { flexDirection: "row", gap: 8 },
  metricCard:  { flex: 1, borderRadius: RADIUS.xl, padding: 12, alignItems: "center", ...SHADOW.sm },
  metricValue: { fontSize: 18, fontWeight: "800" },
  metricLabel: { fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  kpiRow:        { flexDirection: "row", gap: 8 },
  kpiPill:       { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 10, alignItems: "center", ...SHADOW.sm },
  kpiPillValue:  { fontSize: 15, fontWeight: "800" },
  kpiPillLabel:  { fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  baselineNotice: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10 },
  baselineText:   { flex: 1, fontSize: 11, color: COLORS.primary, lineHeight: 16, fontWeight: "500" },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },

  card:         { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardUrgent:   { borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  cardFailed:   { opacity: 0.75, borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  statusIcon:   { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  sowName:      { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  sowId:        { fontSize: 10, color: COLORS.textMuted, fontFamily: "monospace" },
  breedDate:    { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusBadge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusBadgeText:   { fontSize: 11, fontWeight: "700" },
  farrowRow:         { flexDirection: "row", justifyContent: "space-between", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 8, marginBottom: 8 },
  farrowRowUrgent:   { backgroundColor: COLORS.dangerBg },
  farrowLabel:       { fontSize: 11, color: COLORS.textMuted },
  farrowValue:       { fontSize: 11, color: COLORS.textPrimary, fontWeight: "600" },
  pigletsRow:        { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  pigletBadge:       { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.healthyBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  pigletBadgeText:   { fontSize: 11, color: COLORS.healthy, fontWeight: "600" },
  actionBtns:        { flexDirection: "row", gap: 8 },
  actionBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.warningBg, borderRadius: RADIUS.lg, paddingVertical: 9 },
  actionBtnGreen:    { backgroundColor: COLORS.primaryLight },
  actionBtnDanger:   { backgroundColor: COLORS.dangerBg },
  actionBtnText:     { color: COLORS.warning, fontWeight: "700", fontSize: 12 },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:   { fontSize: 12, color: COLORS.textMuted },

  fab:     { position: "absolute", bottom: 24, alignSelf: "center", backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 14, ...SHADOW.lg },
  fabText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },

  modal:          { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:     { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, flex: 1 },
  modalClose:     { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  modalInput:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  modalInputError:{ borderColor: "#E53935", borderWidth: 1.5 },
  fieldLabel:     { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  errorText:      { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },
  dateBtn:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, borderWidth: 1, borderColor: COLORS.border },
  dateBtnError:   { borderColor: "#E53935", borderWidth: 1.5 },
  pickerBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  pickerBtnError: { borderColor: "#E53935", borderWidth: 1.5 },
  infoBox:        { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 12, marginTop: 14 },
  infoBoxText:    { fontSize: 12, color: COLORS.primary, lineHeight: 18 },
  warnBox:        { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 },
  warnText:       { fontSize: 12, color: COLORS.warning, fontWeight: "500" },
  saveBtn:        { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  saveBtnText:    { color: COLORS.white, fontWeight: "700", fontSize: 15 },

  sowOption:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  sowOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight, borderWidth: 2 },
  sowOptionAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  sowOptionName:   { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  sowOptionId:     { fontSize: 11, color: COLORS.textMuted, fontFamily: "monospace" },
  sowOptionMeta:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  sowStatusChip:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  sowStatusText:   { fontSize: 10, fontWeight: "600" },

  weaningSection: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.lg, padding: 14, marginTop: 14 },
  weaningHint:    { fontSize: 11, color: COLORS.primary, fontStyle: "italic" },

  failedInfoBox:  { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: COLORS.dangerBg, borderRadius: RADIUS.lg, padding: 14, borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  failedInfoText: { flex: 1, fontSize: 12, color: COLORS.danger, lineHeight: 18 },
});