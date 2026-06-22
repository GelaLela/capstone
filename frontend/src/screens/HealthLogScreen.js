/**
 * frontend/src/screens/HealthLogScreen.js
 *
 * Redesigned with:
 *  - Structured disease category + disease name picker (no free-text guessing)
 *  - Full catalogue of common swine conditions from health_intelligence
 *  - Vitals, physical signs, treatment, outcome, recovery date
 *  - All emojis replaced with PNG icons
 *  - No tintColor on icons
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Switch, Alert, ActivityIndicator, Image, Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const ICONS = {
  health:    require("../assets/icons/pill.png"),
  analytics: require("../assets/icons/analytics.png"),
  audit:     require("../assets/icons/audit.png"),
  vaccine:   require("../assets/icons/vaccine.png"),
  pig:       require("../assets/icons/pig.png"),
  bell:      require("../assets/icons/bell.png"),
  forecast:  require("../assets/icons/forecast.png"),
};

// ─────────────────────────────────────────────────────────────────────────────
// Structured disease catalogue (mirrors health_intelligence.DISEASE_CATEGORIES)
// ─────────────────────────────────────────────────────────────────────────────
const DISEASE_CATALOGUE = [
  {
    key: "respiratory", label: "Respiratory", color: COLORS.danger,
    bg: COLORS.dangerBg,
    diseases: [
      "Swine Influenza",
      "Mycoplasma Pneumonia",
      "PRRS (Porcine Reproductive & Respiratory Syndrome)",
      "Actinobacillus Pleuropneumonia (APP)",
      "Enzootic Pneumonia",
      "Pasteurellosis",
      "Bordetellosis (Atrophic Rhinitis)",
    ],
  },
  {
    key: "digestive", label: "Digestive", color: COLORS.warning,
    bg: COLORS.warningBg,
    diseases: [
      "Colibacillosis (E. coli Infection)",
      "Salmonellosis",
      "Swine Dysentery",
      "Ileitis (Porcine Proliferative Enteropathy)",
      "Transmissible Gastroenteritis (TGE)",
      "Porcine Epidemic Diarrhea (PED)",
      "Rotavirus Infection",
    ],
  },
  {
    key: "skin", label: "Skin & External", color: COLORS.amber,
    bg: COLORS.amberBg,
    diseases: [
      "Mange (Sarcoptic)",
      "Ringworm (Dermatophytosis)",
      "Greasy Pig Disease (Exudative Epidermitis)",
      "Swine Pox",
      "Foot-and-Mouth Disease (FMD)",
    ],
  },
  {
    key: "reproductive", label: "Reproductive", color: COLORS.pink,
    bg: COLORS.pinkBg,
    diseases: [
      "Mastitis",
      "Metritis",
      "Agalactia (MMA Syndrome)",
      "PRRS Reproductive Form",
      "Brucellosis",
      "Leptospirosis",
      "Parvovirus Infection",
      "Stillbirths / Mummified Fetuses",
    ],
  },
  {
    key: "parasitic", label: "Parasitic", color: COLORS.purple,
    bg: COLORS.purpleBg,
    diseases: [
      "Internal Worms (Ascariasis)",
      "Roundworms",
      "Lungworms",
      "Lice (Pediculosis)",
      "Mites",
      "Coccidiosis",
      "Toxoplasmosis",
    ],
  },
  {
    key: "nutritional", label: "Nutritional", color: COLORS.healthy,
    bg: COLORS.healthyBg,
    diseases: [
      "Vitamin A Deficiency",
      "Vitamin E / Selenium Deficiency",
      "Iron Deficiency Anemia",
      "Calcium / Phosphorus Imbalance",
      "Zinc Deficiency (Parakeratosis)",
      "Salt Poisoning (Water Deprivation)",
    ],
  },
  {
    key: "systemic", label: "Systemic / Other", color: COLORS.textMuted,
    bg: COLORS.screenBg,
    diseases: [
      "African Swine Fever (ASF)",
      "Hog Cholera (Classical Swine Fever)",
      "Erysipelas",
      "Meningitis (Streptococcal)",
      "Septicemia",
      "Fever (Unknown Origin)",
      "Lameness (Unknown Cause)",
      "Injury / Trauma",
      "Heat Stress",
      "Dehydration",
    ],
  },
];

const SEVERITY_CONFIG = {
  normal:   { color: COLORS.healthy, bg: COLORS.healthyBg, label: "Normal"   },
  warning:  { color: COLORS.warning, bg: COLORS.warningBg, label: "Warning"  },
  critical: { color: COLORS.danger,  bg: COLORS.dangerBg,  label: "Critical" },
};

export default function HealthLogScreen({ route }) {
  const { pig } = route.params;
  const [logs,     setLogs]    = useState([]);
  const [loading,  setLoading] = useState(true);
  const [showForm, setShowForm]= useState(false);
  const [saving,   setSaving]  = useState(false);
  const [tab,      setTab]     = useState("vitals");  // "vitals" | "disease"

  // ── Vitals form ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    temperature_c: "", respiratory_rate: "", heart_rate: "",
    appetite: "normal", behavior: "normal", stool_condition: "normal",
    has_cough: false, has_nasal_discharge: false, has_skin_lesions: false,
    has_lameness: false, has_vomiting: false, notes: "",
  });

  // ── Disease record form ────────────────────────────────────────────────────
  const [diseaseForm, setDiseaseForm] = useState({
    disease_category: "", disease_name: "",
    severity: "warning", treatment: "", outcome: "ongoing",
    resolved_date: "", notes: "",
  });
  const [diseaseErrors,  setDiseaseErrors]  = useState({});
  const [showCatPicker,  setShowCatPicker]  = useState(false);
  const [showNamePicker, setShowNamePicker] = useState(false);
  const [showResDate,    setShowResDate]    = useState(false);
  const [savingDisease,  setSavingDisease]  = useState(false);

  function setF(field, value) { setForm(prev => ({ ...prev, [field]: value })); }
  function setD(field, value) {
    setDiseaseForm(prev => ({ ...prev, [field]: value }));
    if (diseaseErrors[field]) setDiseaseErrors(p => ({ ...p, [field]: null }));
  }

  const selectedCat = DISEASE_CATALOGUE.find(c => c.key === diseaseForm.disease_category);

  useFocusEffect(useCallback(() => {
    api.getHealthLogs(pig.id)
      .then(d => setLogs(d.results || d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []));

  // ── Submit vitals health log ───────────────────────────────────────────────
  async function handleSubmitVitals() {
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
      Alert.alert(cfg.label, result.system_findings, [{
        text: "OK", onPress: () => {
          setShowForm(false);
          setLogs(prev => [result, ...prev]);
          setForm({
            temperature_c: "", respiratory_rate: "", heart_rate: "",
            appetite: "normal", behavior: "normal", stool_condition: "normal",
            has_cough: false, has_nasal_discharge: false, has_skin_lesions: false,
            has_lameness: false, has_vomiting: false, notes: "",
          });
        },
      }]);
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  }

  // ── Submit disease record ──────────────────────────────────────────────────
  async function handleSubmitDisease() {
    const e = {};
    if (!diseaseForm.disease_category) e.disease_category = "Please select a disease category.";
    if (!diseaseForm.disease_name)     e.disease_name     = "Please select a disease name.";
    setDiseaseErrors(e);
    if (Object.keys(e).length > 0) return;

    setSavingDisease(true);
    try {
      await api.addDisease(pig.id, {
        disease_category: diseaseForm.disease_category,
        disease_name:     diseaseForm.disease_name,
        diagnosed_date:   new Date().toISOString().split("T")[0],
        treatment:        diseaseForm.treatment,
        outcome:          diseaseForm.outcome,
        resolved_date:    diseaseForm.outcome === "recovered" && diseaseForm.resolved_date
                            ? diseaseForm.resolved_date : null,
        notes:            diseaseForm.notes,
      });
      Alert.alert("Disease Recorded", `${diseaseForm.disease_name} has been logged. Analytics updated.`);
      setDiseaseForm({
        disease_category: "", disease_name: "",
        severity: "warning", treatment: "", outcome: "ongoing", resolved_date: "", notes: "",
      });
      setShowForm(false);
    } catch (e2) { Alert.alert("Error", e2.message); }
    finally { setSavingDisease(false); }
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={s.screen}>
      {/* Pig header */}
      <View style={s.pigHeader}>
        <View style={s.pigAvatarWrap}>
          <Image source={ICONS.pig} style={{ width: 30, height: 30, resizeMode: "contain" }} />
        </View>
        <View>
          <Text style={s.pigHeaderId}>{pig.pig_id}</Text>
          <Text style={s.pigHeaderName}>{pig.name}</Text>
          <Text style={s.pigHeaderMeta}>
            {pig.growth_stage?.charAt(0).toUpperCase() + pig.growth_stage?.slice(1)}
            {pig.latest_weight ? ` · ${pig.latest_weight} kg` : ""}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>

        {/* Toggle */}
        <TouchableOpacity
          style={[s.toggleBtn, showForm && { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger }]}
          onPress={() => setShowForm(!showForm)}>
          <Image source={ICONS.health} style={{ width: 18, height: 18, resizeMode: "contain" }} />
          <Text style={[s.toggleBtnText, showForm && { color: COLORS.danger }]}>
            {showForm ? "Cancel" : "Log Health Check or Disease"}
          </Text>
        </TouchableOpacity>

        {showForm && (
          <>
            {/* Sub-tabs: Vitals vs Disease */}
            <View style={s.subTabRow}>
              <TouchableOpacity
                style={[s.subTab, tab === "vitals" && s.subTabActive]}
                onPress={() => setTab("vitals")}>
                <Image source={ICONS.analytics}
                  style={[s.subTabIcon, tab !== "vitals" && { opacity: 0.4 }]} />
                <Text style={[s.subTabText, tab === "vitals" && s.subTabTextActive]}>
                  Vitals Check
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.subTab, tab === "disease" && s.subTabActive]}
                onPress={() => setTab("disease")}>
                <Image source={ICONS.health}
                  style={[s.subTabIcon, tab !== "disease" && { opacity: 0.4 }]} />
                <Text style={[s.subTabText, tab === "disease" && s.subTabTextActive]}>
                  Disease Record
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── VITALS TAB ─────────────────────────────────────────────── */}
            {tab === "vitals" && (
              <View style={s.formCard}>
                <Text style={s.formHint}>
                  Fill in what you can observe. Leave blank if not measured.
                  The system auto-evaluates against veterinary standards.
                </Text>

                <FormSection title="Vitals" icon={ICONS.analytics}>
                  <VitalInput label="Temperature (°C)" hint="Normal: 38.0–39.5°C"
                    placeholder="e.g. 38.5" value={form.temperature_c}
                    onChangeText={v => setF("temperature_c", v)} keyboardType="decimal-pad" />
                  <VitalInput label="Respiratory rate (breaths/min)" hint="Normal: 15–25"
                    placeholder="e.g. 18" value={form.respiratory_rate}
                    onChangeText={v => setF("respiratory_rate", v)} keyboardType="number-pad" />
                  <VitalInput label="Heart rate (BPM)" hint="Normal: 60–80"
                    placeholder="e.g. 70" value={form.heart_rate}
                    onChangeText={v => setF("heart_rate", v)} keyboardType="number-pad" />
                </FormSection>

                <FormSection title="Appetite" icon={ICONS.pig}>
                  <ChipGroup options={["normal","poor","none"]} labels={["Normal","Poor","Not eating"]}
                    colors={[COLORS.healthy, COLORS.warning, COLORS.danger]}
                    bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.dangerBg]}
                    value={form.appetite} onChange={v => setF("appetite", v)} />
                </FormSection>

                <FormSection title="Behavior" icon={ICONS.pig}>
                  <ChipGroup options={["normal","lethargic","aggressive","isolating"]}
                    labels={["Normal","Lethargic","Aggressive","Isolating"]}
                    colors={[COLORS.healthy, COLORS.warning, COLORS.danger, COLORS.warning]}
                    bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.dangerBg, COLORS.warningBg]}
                    value={form.behavior} onChange={v => setF("behavior", v)} />
                </FormSection>

                <FormSection title="Stool Condition" icon={ICONS.health}>
                  <ChipGroup options={["normal","diarrhea","constipated","bloody"]}
                    labels={["Normal","Diarrhea","Constipated","Bloody"]}
                    colors={[COLORS.healthy, COLORS.warning, COLORS.warning, COLORS.danger]}
                    bgs={[COLORS.healthyBg, COLORS.warningBg, COLORS.warningBg, COLORS.dangerBg]}
                    value={form.stool_condition} onChange={v => setF("stool_condition", v)} />
                </FormSection>

                <FormSection title="Physical Signs Observed" icon={ICONS.vaccine}>
                  {[
                    { key: "has_cough",           label: "Coughing"            },
                    { key: "has_nasal_discharge",  label: "Nasal discharge"     },
                    { key: "has_skin_lesions",     label: "Skin lesions"        },
                    { key: "has_lameness",         label: "Lameness / limping"  },
                    { key: "has_vomiting",         label: "Vomiting"            },
                  ].map(item => (
                    <View key={item.key} style={s.switchRow}>
                      <Image source={ICONS.health} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                      <Text style={s.switchLabel}>{item.label}</Text>
                      <Switch value={form[item.key]} onValueChange={v => setF(item.key, v)}
                        trackColor={{ false: COLORS.border, true: COLORS.primary }}
                        thumbColor={form[item.key] ? COLORS.white : "#f4f4f4"} />
                    </View>
                  ))}
                </FormSection>

                <FormSection title="Additional Notes" icon={ICONS.audit}>
                  <TextInput style={s.notesInput} value={form.notes}
                    onChangeText={v => setF("notes", v)}
                    placeholder="Any other observations..." placeholderTextColor={COLORS.textMuted}
                    multiline numberOfLines={3} textAlignVertical="top" />
                </FormSection>

                <TouchableOpacity style={s.submitBtn} onPress={handleSubmitVitals} disabled={saving}>
                  {saving ? <ActivityIndicator color={COLORS.white} />
                          : <Text style={s.submitBtnText}>Submit and Evaluate</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* ── DISEASE RECORD TAB ─────────────────────────────────────── */}
            {tab === "disease" && (
              <View style={s.formCard}>
                <Text style={s.formHint}>
                  Select from the structured disease catalogue.
                  This keeps analytics accurate and enables disease distribution reporting.
                </Text>

                {/* Disease category picker */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.fieldLabel}>
                    Disease Category<Text style={{ color: "#E53935" }}> *</Text>
                  </Text>
                  <TouchableOpacity
                    style={[s.pickerBtn, diseaseErrors.disease_category && s.pickerBtnError]}
                    onPress={() => setShowCatPicker(true)}>
                    {selectedCat ? (
                      <View style={[s.catChip, { backgroundColor: selectedCat.bg }]}>
                        <Text style={[s.catChipText, { color: selectedCat.color }]}>
                          {selectedCat.label}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
                        Tap to select disease category...
                      </Text>
                    )}
                    <Image source={ICONS.forecast} style={{ width: 14, height: 14, resizeMode: "contain", opacity: 0.4 }} />
                  </TouchableOpacity>
                  {diseaseErrors.disease_category && (
                    <Text style={s.errorText}>{diseaseErrors.disease_category}</Text>
                  )}
                </View>

                {/* Disease name picker (only shown after category selected) */}
                {selectedCat && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={s.fieldLabel}>
                      Disease Name<Text style={{ color: "#E53935" }}> *</Text>
                    </Text>
                    <TouchableOpacity
                      style={[s.pickerBtn, diseaseErrors.disease_name && s.pickerBtnError]}
                      onPress={() => setShowNamePicker(true)}>
                      <Text style={{ fontSize: 14, color: diseaseForm.disease_name ? COLORS.textPrimary : COLORS.textMuted }}>
                        {diseaseForm.disease_name || "Tap to select disease name..."}
                      </Text>
                      <Image source={ICONS.forecast} style={{ width: 14, height: 14, resizeMode: "contain", opacity: 0.4 }} />
                    </TouchableOpacity>
                    {diseaseErrors.disease_name && (
                      <Text style={s.errorText}>{diseaseErrors.disease_name}</Text>
                    )}
                  </View>
                )}

                {/* Treatment */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.fieldLabel}>Treatment given (optional)</Text>
                  <TextInput style={s.input} value={diseaseForm.treatment}
                    onChangeText={v => setD("treatment", v)}
                    placeholder="e.g. Amoxicillin 500mg, 3 days"
                    placeholderTextColor={COLORS.textMuted} />
                </View>

                {/* Outcome */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.fieldLabel}>Outcome</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {[["ongoing","Ongoing",COLORS.warning],["recovered","Recovered",COLORS.healthy],["deceased","Deceased",COLORS.danger]].map(([key, label, color]) => (
                      <TouchableOpacity key={key}
                        style={[s.outcomeChip, diseaseForm.outcome === key && { backgroundColor: color + "22", borderColor: color }]}
                        onPress={() => setD("outcome", key)}>
                        <Text style={[s.outcomeChipText, diseaseForm.outcome === key && { color, fontWeight: "700" }]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Recovery date (only if recovered) */}
                {diseaseForm.outcome === "recovered" && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={s.fieldLabel}>Recovery date</Text>
                    <TouchableOpacity style={[s.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                      onPress={() => setShowResDate(true)}>
                      <Text style={{ fontSize: 14, color: diseaseForm.resolved_date ? COLORS.textPrimary : COLORS.textMuted }}>
                        {diseaseForm.resolved_date || "Tap to select date"}
                      </Text>
                      <Image source={ICONS.forecast} style={{ width: 14, height: 14, resizeMode: "contain", opacity: 0.5 }} />
                    </TouchableOpacity>
                    {showResDate && (
                      <DateTimePicker
                        value={diseaseForm.resolved_date ? new Date(diseaseForm.resolved_date) : new Date()}
                        mode="date" display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={(e, d) => {
                          setShowResDate(Platform.OS === "ios");
                          if (d) setD("resolved_date", d.toISOString().split("T")[0]);
                        }}
                      />
                    )}
                  </View>
                )}

                {/* Notes */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.fieldLabel}>Notes (optional)</Text>
                  <TextInput style={s.notesInput} value={diseaseForm.notes}
                    onChangeText={v => setD("notes", v)}
                    placeholder="Symptoms, observations, dosage..." placeholderTextColor={COLORS.textMuted}
                    multiline numberOfLines={3} textAlignVertical="top" />
                </View>

                <TouchableOpacity style={s.submitBtn} onPress={handleSubmitDisease} disabled={savingDisease}>
                  {savingDisease ? <ActivityIndicator color={COLORS.white} />
                                 : <Text style={s.submitBtnText}>Save Disease Record</Text>}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Past health logs */}
        <Text style={s.sectionTitle}>Health Log History</Text>
        {logs.length === 0 && (
          <View style={s.emptyState}>
            <Image source={ICONS.audit} style={{ width: 36, height: 36, resizeMode: "contain", opacity: 0.4, marginBottom: 8 }} />
            <Text style={s.emptyTitle}>No health logs yet</Text>
            <Text style={s.emptySub}>Tap the button above to start monitoring</Text>
          </View>
        )}
        {logs.map((log, i) => {
          const cfg = SEVERITY_CONFIG[log.severity] || SEVERITY_CONFIG.normal;
          return (
            <View key={i} style={[s.logCard, { borderLeftColor: cfg.color }]}>
              <View style={s.logHeader}>
                <View style={[s.severityBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.severityText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                <Text style={s.logTime}>{log.date_logged} {log.time_logged?.slice(0,5)}</Text>
              </View>

              <View style={s.logVitals}>
                {log.temperature_c    && log.temperature_c    !== "N/A" && <VBadge icon={ICONS.analytics} label={`${log.temperature_c}°C`} />}
                {log.respiratory_rate && log.respiratory_rate !== "N/A" && <VBadge icon={ICONS.analytics} label={`${log.respiratory_rate} br/m`} />}
                {log.heart_rate       && log.heart_rate       !== "N/A" && <VBadge icon={ICONS.analytics} label={`${log.heart_rate} BPM`} />}
                {(!log.temperature_c || log.temperature_c === "N/A") &&
                 (!log.respiratory_rate || log.respiratory_rate === "N/A") &&
                 (!log.heart_rate || log.heart_rate === "N/A") && (
                  <VBadge icon={ICONS.analytics} label="Vitals: N/A" />
                )}
              </View>

              <Text style={s.logObs}>
                Appetite: {log.appetite}  ·  Behavior: {log.behavior}  ·  Stool: {log.stool_condition}
              </Text>

              {log.system_findings && (
                <View style={[s.findingsBox, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.findingsText, { color: cfg.color }]}>{log.system_findings}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Disease category picker modal */}
      <Modal visible={showCatPicker} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => setShowCatPicker(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Select Disease Category</Text>
            <TouchableOpacity onPress={() => setShowCatPicker(false)}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
            {DISEASE_CATALOGUE.map(cat => (
              <TouchableOpacity key={cat.key}
                style={[s.catOption, diseaseForm.disease_category === cat.key && { backgroundColor: cat.bg, borderColor: cat.color, borderWidth: 1.5 }]}
                onPress={() => {
                  setD("disease_category", cat.key);
                  setD("disease_name", "");
                  setShowCatPicker(false);
                }}>
                <Text style={[s.catOptionText, { color: cat.color }]}>{cat.label}</Text>
                <Text style={s.catOptionCount}>{cat.diseases.length} conditions</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Disease name picker modal */}
      <Modal visible={showNamePicker} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => setShowNamePicker(false)}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{selectedCat?.label || "Select Disease"}</Text>
            <TouchableOpacity onPress={() => setShowNamePicker(false)}>
              <Text style={s.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {selectedCat?.diseases.map(disease => (
              <TouchableOpacity key={disease}
                style={[s.diseaseOption, diseaseForm.disease_name === disease && { backgroundColor: selectedCat.bg, borderColor: selectedCat.color, borderWidth: 1.5 }]}
                onPress={() => {
                  setD("disease_name", disease);
                  setShowNamePicker(false);
                }}>
                <Text style={s.diseaseOptionText}>{disease}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FormSection({ title, icon, children }) {
  return (
    <View style={s.formSection}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Image source={icon} style={{ width: 14, height: 14, resizeMode: "contain" }} />
        <Text style={s.formSectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function VitalInput({ label, hint, placeholder, value, onChangeText, keyboardType }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: "500" }}>{label}</Text>
        {hint && <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{hint}</Text>}
      </View>
      <TextInput style={s.vitalInput} placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted} value={value}
        onChangeText={onChangeText} keyboardType={keyboardType} />
    </View>
  );
}

function ChipGroup({ options, labels, colors, bgs, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt, i) => {
        const active = value === opt;
        return (
          <TouchableOpacity key={opt}
            style={[s.chip, active && { backgroundColor: bgs[i], borderColor: colors[i] }]}
            onPress={() => onChange(opt)} activeOpacity={0.8}>
            <Text style={[s.chipText, active && { color: colors[i], fontWeight: "700" }]}>{labels[i]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function VBadge({ icon, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Image source={icon} style={{ width: 11, height: 11, resizeMode: "contain" }} />
      <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  pigHeader:    { backgroundColor: COLORS.primary, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  pigAvatarWrap:{ width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  pigHeaderId:  { fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: "monospace" },
  pigHeaderName:{ fontSize: 18, fontWeight: "800", color: COLORS.white },
  pigHeaderMeta:{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  toggleBtn:      { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 15, borderWidth: 1.5, borderColor: COLORS.primary, ...SHADOW.sm },
  toggleBtnText:  { fontSize: 14, fontWeight: "700", color: COLORS.primary },

  subTabRow:         { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 4, ...SHADOW.sm },
  subTab:            { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, borderRadius: RADIUS.lg, gap: 5 },
  subTabActive:      { backgroundColor: COLORS.primary },
  subTabIcon:        { width: 14, height: 14, resizeMode: "contain" },
  subTabText:        { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  subTabTextActive:  { color: COLORS.white, fontWeight: "700" },

  formCard:        { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, gap: 14, ...SHADOW.sm },
  formHint:        { fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10 },
  formSection:     { gap: 8 },
  formSectionTitle:{ fontSize: 13, fontWeight: "700", color: COLORS.primary },

  vitalInput: { width: 100, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, textAlign: "center" },
  chip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg },
  chipText:   { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  switchRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, gap: 8 },
  switchLabel:{ flex: 1, fontSize: 14, color: COLORS.textPrimary },
  notesInput: { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 12, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, minHeight: 80 },
  submitBtn:  { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: "center" },
  submitBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },

  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  errorText:  { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },

  pickerBtn:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, borderWidth: 1, borderColor: COLORS.border },
  pickerBtnError: { borderColor: "#E53935", borderWidth: 1.5 },
  catChip:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  catChipText:    { fontSize: 13, fontWeight: "700" },
  outcomeChip:    { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg, alignItems: "center" },
  outcomeChipText:{ fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  input:          { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  emptyState:   { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyTitle:   { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:     { fontSize: 12, color: COLORS.textMuted, textAlign: "center" },

  logCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, borderLeftWidth: 3, ...SHADOW.sm },
  logHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  severityBadge:{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  severityText: { fontSize: 12, fontWeight: "700" },
  logTime:      { fontSize: 11, color: COLORS.textMuted },
  logVitals:    { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  logObs:       { fontSize: 11, color: COLORS.textMuted, marginBottom: 6 },
  findingsBox:  { borderRadius: RADIUS.md, padding: 10 },
  findingsText: { fontSize: 12, lineHeight: 18 },

  modal:       { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:  { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  modalClose:  { fontSize: 14, color: COLORS.primary, fontWeight: "700" },
  catOption:   { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  catOptionText:  { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  catOptionCount: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  diseaseOption:  { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  diseaseOptionText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: "500" },
});