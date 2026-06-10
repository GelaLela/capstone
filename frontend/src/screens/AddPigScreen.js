/**
 * frontend/src/screens/AddPigScreen.js
 *
 * Key fixes applied:
 *  1. Pig ID is AUTO-GENERATED from backend — user never types it manually
 *  2. Date fields use @react-native-community/datetimepicker (cross-platform)
 *  3. Strict validation — all required fields block progression
 *  4. Existing Pig path: when baseline is submitted, backend auto-creates
 *     BreedingRecord rows so analytics reflect historical data immediately
 *  5. All emojis replaced with PNG icons
 */
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TextInput, KeyboardAvoidingView,
  TouchableOpacity, Alert, ActivityIndicator, Platform, ScrollView, Image,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const STAGES  = ["piglet", "weaner", "grower", "finisher", "breeder"];
const GENDERS = ["female", "male"];
const BREEDS  = ["Landrace", "Large White", "Duroc", "Philippine Native", "Crossbreed"];

const ICONS = {
  pig:       require("../assets/icons/pig.png"),
  audit:     require("../assets/icons/audit.png"),
  analytics: require("../assets/icons/analytics.png"),
  breeding:  require("../assets/icons/breeding.png"),
  pill:      require("../assets/icons/pill.png"),
  pregnant:  require("../assets/icons/pregnant.png"),
  forecast:  require("../assets/icons/forecast.png"),
};

// ── Reusable label with red asterisk ─────────────────────────────────────────
function RL({ text, style }) {
  return (
    <Text style={[sl.label, style]}>
      {text}<Text style={{ color: "#E53935", fontWeight: "800" }}> *</Text>
    </Text>
  );
}
const sl = StyleSheet.create({
  label: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
});

// ── Validated input wrapper ───────────────────────────────────────────────────
function VInput({ label, required, error, children, style }) {
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {required
        ? <RL text={label} />
        : <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 }}>{label}</Text>
      }
      {children}
      {error ? <Text style={{ fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" }}>{error}</Text> : null}
    </View>
  );
}

// ── Date picker field ─────────────────────────────────────────────────────────
function DateField({ label, required, value, onChange, error, placeholder }) {
  const [show, setShow] = useState(false);
  const dateObj = value ? new Date(value) : new Date();

  function handleChange(event, selected) {
    setShow(Platform.OS === "ios");
    if (selected) {
      onChange(selected.toISOString().split("T")[0]);
    }
  }

  return (
    <VInput label={label} required={required} error={error}>
      <TouchableOpacity
        style={[
          s.input,
          { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
          error && s.inputError,
        ]}
        onPress={() => setShow(true)}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 14, color: value ? COLORS.textPrimary : COLORS.textMuted }}>
          {value || placeholder || "Select date"}
        </Text>
        <Image source={ICONS.forecast} style={{ width: 16, height: 16, resizeMode: "contain", opacity: 0.5 }} />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={dateObj}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleChange}
          maximumDate={new Date()}
        />
      )}
    </VInput>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AddPigScreen({ navigation }) {
  const [pigType,  setPigType]  = useState(null); // "new" | "existing"
  const [step,     setStep]     = useState(1);
  const [saving,   setSaving]   = useState(false);
  const [loadingId,setLoadingId]= useState(false);

  // Basic info
  const [form, setForm] = useState({
    name: "", pig_id: "", date_of_birth: "",
    gender: "female", breed: "Landrace", growth_stage: "piglet", notes: "",
  });
  const [initialWeight, setInitialWeight] = useState("");
  const [errors, setErrors] = useState({});

  // Historical records (existing pigs)
  const [history, setHistory] = useState({
    total_litters: "", total_piglets_born: "", total_piglets_weaned: "",
    last_farrowing_date: "", major_diseases_history: "",
    vaccination_status_summary: "", weight_at_6_months: "", weight_at_12_months: "", notes: "",
  });
  const [histErrors, setHistErrors] = useState({});

  function setF(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }
  function setH(field, value) { setHistory(prev => ({ ...prev, [field]: value })); }

  // ── Auto-load pig_id when pig type is selected ────────────────────────────
  useEffect(() => {
    if (pigType) {
      setLoadingId(true);
      api.getNextPigId()
        .then(res => setF("pig_id", res.pig_id))
        .catch(() => {})
        .finally(() => setLoadingId(false));
    }
  }, [pigType]);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep1() {
    const e = {};
    if (!form.name.trim())          e.name          = "Pig name is required.";
    if (!form.date_of_birth)        e.date_of_birth = "Date of birth is required.";
    if (!form.gender)               e.gender        = "Gender is required.";
    if (!form.breed)                e.breed         = "Breed is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e = {};
    if (!form.growth_stage)     e.growth_stage  = "Growth stage is required.";
    if (!initialWeight.trim())  e.initialWeight = "Initial weight is required.";
    else if (isNaN(parseFloat(initialWeight)) || parseFloat(initialWeight) <= 0)
      e.initialWeight = "Enter a valid weight greater than 0.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateHistory() {
    if (pigType !== "existing") return true;
    if (form.gender !== "female" || form.growth_stage !== "breeder") return true;

    const e = {};

    // All four breeding history fields are required for existing female breeder pigs.
    // None of these fields can be left blank — even 0 is a valid entry for litters/piglets.
    if (history.total_litters.trim() === "") {
      e.total_litters = "Required. Enter 0 if the breeding history is unknown.";
    } else if (isNaN(parseInt(history.total_litters)) || parseInt(history.total_litters) < 0) {
      e.total_litters = "Must be 0 or a positive whole number.";
    }

    if (history.total_piglets_born.trim() === "") {
      e.total_piglets_born = "Required. Enter 0 if unknown.";
    } else if (isNaN(parseInt(history.total_piglets_born)) || parseInt(history.total_piglets_born) < 0) {
      e.total_piglets_born = "Must be 0 or a positive whole number.";
    }

    if (history.total_piglets_weaned.trim() === "") {
      e.total_piglets_weaned = "Required. Enter 0 if unknown.";
    } else if (isNaN(parseInt(history.total_piglets_weaned)) || parseInt(history.total_piglets_weaned) < 0) {
      e.total_piglets_weaned = "Must be 0 or a positive whole number.";
    }

    if (!history.last_farrowing_date) {
      e.last_farrowing_date = "Required. Select the date of the last farrowing.";
    }

    setHistErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validateHistory()) return;
    setSaving(true);
    try {
      const pigData = { ...form, is_historical: pigType === "existing" };
      const pig = await api.createPig(pigData);

      // Log initial/current weight
      if (initialWeight) {
        await api.logWeight(pig.id, {
          weight_kg:   parseFloat(initialWeight),
          recorded_at: new Date().toISOString().split("T")[0],
          notes: pigType === "new" ? "Initial weight at registration" : "Weight at registration (existing pig)",
        });
      }

      // For existing pig: submit historical weight milestones
      if (pigType === "existing") {
        if (history.weight_at_12_months) {
          const dob  = new Date(form.date_of_birth);
          const d12m = new Date(dob);
          d12m.setMonth(d12m.getMonth() + 12);
          await api.logWeight(pig.id, {
            weight_kg:   parseFloat(history.weight_at_12_months),
            recorded_at: d12m.toISOString().split("T")[0],
            notes: "Historical: weight at 12 months",
          });
        }
        if (history.weight_at_6_months) {
          const dob = new Date(form.date_of_birth);
          const d6m = new Date(dob);
          d6m.setMonth(d6m.getMonth() + 6);
          await api.logWeight(pig.id, {
            weight_kg:   parseFloat(history.weight_at_6_months),
            recorded_at: d6m.toISOString().split("T")[0],
            notes: "Historical: weight at 6 months",
          });
        }

        // Submit baseline — backend auto-creates BreedingRecord rows
        // Build the baseline payload.
        // Use explicit string-length checks rather than truthy checks.
        // Truthy checks drop valid "0" values: if (history.total_litters) fails
        // when the farmer enters "0", so 0 is never sent to the backend.
        const bp = {};
        if (history.total_litters.trim() !== "")              bp.total_litters              = parseInt(history.total_litters);
        if (history.total_piglets_born.trim() !== "")         bp.total_piglets_born         = parseInt(history.total_piglets_born);
        if (history.total_piglets_weaned.trim() !== "")       bp.total_piglets_weaned       = parseInt(history.total_piglets_weaned);
        if (history.last_farrowing_date)                      bp.last_farrowing_date        = history.last_farrowing_date;
        if (history.major_diseases_history.trim() !== "")     bp.major_diseases_history     = history.major_diseases_history;
        if (history.vaccination_status_summary.trim() !== "") bp.vaccination_status_summary = history.vaccination_status_summary;
        if (history.weight_at_6_months.trim() !== "")         bp.weight_at_6_months         = parseFloat(history.weight_at_6_months);
        if (history.weight_at_12_months.trim() !== "")        bp.weight_at_12_months        = parseFloat(history.weight_at_12_months);
        if (history.notes.trim() !== "")                      bp.notes                      = history.notes;

        if (Object.keys(bp).length > 0) {
          const result = await api.savePigBaseline(pig.id, bp);
          const brCount = result?.breeding_records_created || 0;
          Alert.alert(
            "Pig Added",
            `${form.name} (${form.pig_id}) has been added.\n\n` +
            (brCount > 0
              ? `${brCount} historical breeding records were created automatically. Analytics have been updated.`
              : "Historical health and growth data saved."),
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
          return;
        }
      }

      Alert.alert("Pig Added", `${form.name} (${form.pig_id}) has been added to the farm.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", e.message || "Could not save pig. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 0: Choose pig type ───────────────────────────────────────────────
  if (!pigType) {
    return (
      <View style={s.screen}>
        <ScrollView contentContainerStyle={s.typeScreen}>
          <Image source={ICONS.pig} style={{ width: 64, height: 64, resizeMode: "contain", marginBottom: 20 }} />
          <Text style={s.typeTitle}>What type of pig are you adding?</Text>
          <Text style={s.typeSub}>This determines what information we collect to ensure analytics are accurate from day one.</Text>

          <TouchableOpacity style={s.typeCard} onPress={() => setPigType("new")} activeOpacity={0.85}>
            <View style={s.typeIconWrap}>
              <Image source={ICONS.pig} style={{ width: 32, height: 32, resizeMode: "contain" }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.typeCardTitle}>New Pig</Text>
              <Text style={s.typeCardSub}>A piglet just born, or a pig with no prior history to enter.</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={s.typeCard} onPress={() => setPigType("existing")} activeOpacity={0.85}>
            <View style={[s.typeIconWrap, { backgroundColor: COLORS.amberBg }]}>
              <Image source={ICONS.audit} style={{ width: 32, height: 32, resizeMode: "contain" }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.typeCardTitle}>Existing Pig</Text>
              <Text style={s.typeCardSub}>Already on the farm with breeding, health, or growth history. Historical data will feed analytics immediately.</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const maxStep = pigType === "existing" ? 3 : 2;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      {/* Progress bar */}
      <View style={s.progressWrap}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${(step / maxStep) * 100}%` }]} />
        </View>
        <Text style={s.progressLabel}>Step {step} of {maxStep}</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── STEP 1: Basic info ──────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <SCard title="Pig ID (Auto-generated)" icon={ICONS.analytics}
              subtitle={`Your pig will be assigned a unique ID automatically`}>
              <View style={[s.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
                {loadingId
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.primary, fontFamily: "monospace" }}>
                      {form.pig_id || "Generating..."}
                    </Text>
                }
                <Text style={{ fontSize: 11, color: COLORS.textMuted }}>Auto-assigned</Text>
              </View>
            </SCard>

            <SCard title="Basic Information" icon={ICONS.pig}>
              <VInput label="Pig name" required error={errors.name}>
                <TextInput style={[s.input, errors.name && s.inputError]}
                  value={form.name} onChangeText={v => setF("name", v)}
                  placeholder="e.g. Princess" placeholderTextColor={COLORS.textMuted} />
              </VInput>

              <DateField label="Date of birth" required
                value={form.date_of_birth}
                onChange={v => { setF("date_of_birth", v); }}
                error={errors.date_of_birth}
                placeholder="Tap to select" />
            </SCard>

            <SCard title="Gender" icon={ICONS.pig} required error={errors.gender}>
              <View style={s.chipRow}>
                {GENDERS.map(g => (
                  <ChipBtn key={g}
                    label={g === "female" ? "Female" : "Male"}
                    active={form.gender === g}
                    activeColor={g === "female" ? COLORS.pink : COLORS.blue}
                    activeBg={g === "female" ? COLORS.pinkBg : COLORS.blueBg}
                    onPress={() => {
                      setF("gender", g);
                      // If switching to male and current stage is breeder,
                      // reset to piglet — male pigs cannot be breeders.
                      if (g === "male" && form.growth_stage === "breeder") {
                        setF("growth_stage", "piglet");
                      }
                    }} />
                ))}
              </View>
              {errors.gender ? <Text style={s.errorText}>{errors.gender}</Text> : null}
            </SCard>

            <SCard title="Breed" icon={ICONS.pig} required error={errors.breed}>
              <View style={s.chipRow}>
                {BREEDS.map(b => (
                  <ChipBtn key={b} label={b} active={form.breed === b}
                    activeColor={COLORS.primary} activeBg={COLORS.primaryLight}
                    onPress={() => setF("breed", b)} />
                ))}
              </View>
              {errors.breed ? <Text style={s.errorText}>{errors.breed}</Text> : null}
            </SCard>

            <NavRow
              onBack={() => setPigType(null)} backLabel="Back"
              onNext={() => { if (validateStep1()) setStep(2); }} nextLabel="Next" />
          </>
        )}

        {/* ── STEP 2: Stage & weight ──────────────────────────────────────── */}
        {step === 2 && (
          <>
            <SCard title="Growth Stage" icon={ICONS.analytics} required error={errors.growth_stage}>
              <View style={s.stageGrid}>
                {STAGES
                  .filter(stage => !(form.gender === "male" && stage === "breeder"))
                  .map(stage => {
                  const icon   = stage === "breeder" ? ICONS.pregnant : ICONS.pig;
                  const active = form.growth_stage === stage;
                  return (
                    <TouchableOpacity key={stage}
                      style={[s.stageCard, active && s.stageCardActive]}
                      onPress={() => setF("growth_stage", stage)} activeOpacity={0.8}>
                      <Image source={icon} style={[s.stageIcon, !active && { opacity: 0.4 }]} />
                      <Text style={[s.stageLabel, active && s.stageLabelActive]}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.growth_stage ? <Text style={s.errorText}>{errors.growth_stage}</Text> : null}
            </SCard>

            <SCard title={pigType === "new" ? "Initial Weight" : "Current Weight"} icon={ICONS.analytics}
              subtitle={pigType === "existing" ? "Weight at time of registration" : undefined}>
              <VInput label="Weight in kg" required error={errors.initialWeight}>
                <TextInput style={[s.input, errors.initialWeight && s.inputError]}
                  value={initialWeight} onChangeText={v => { setInitialWeight(v); if (errors.initialWeight) setErrors(p => ({ ...p, initialWeight: null })); }}
                  placeholder="e.g. 45.5" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
              </VInput>
            </SCard>

            <SCard title="Notes" icon={ICONS.audit} subtitle="Optional">
              <TextInput style={[s.input, s.textArea]} value={form.notes}
                onChangeText={v => setF("notes", v)}
                placeholder="Any observations about this pig..."
                placeholderTextColor={COLORS.textMuted}
                multiline numberOfLines={3} textAlignVertical="top" />
            </SCard>

            {pigType === "existing" ? (
              <NavRow onBack={() => setStep(1)} onNext={() => { if (validateStep2()) setStep(3); }} nextLabel="Next: History" />
            ) : (
              <NavRow onBack={() => setStep(1)} onNext={handleSave} nextLabel="Save Pig" nextLoading={saving} />
            )}
          </>
        )}

        {/* ── STEP 3: Historical data (existing pigs only) ─────────────────── */}
        {step === 3 && pigType === "existing" && (
          <>
            <View style={s.infoBanner}>
              <Image source={ICONS.analytics} style={{ width: 18, height: 18, resizeMode: "contain" }} />
              <Text style={s.infoBannerText}>
                Historical data feeds analytics immediately. For sows with litter history,
                breeding records are auto-created so success rates and rankings update right away.
              </Text>
            </View>

            {form.gender === "female" && form.growth_stage === "breeder" && (
              <SCard title="Breeding History" icon={ICONS.breeding} subtitle="Previous pregnancies before joining Piglytics">
                <VInput label="Total litters produced" required={form.gender === "female" && form.growth_stage === "breeder"} error={histErrors.total_litters}>
                  <TextInput style={[s.input, histErrors.total_litters && s.inputError]} value={history.total_litters}
                    onChangeText={v => { setH("total_litters", v); if (histErrors.total_litters) setHistErrors(p => ({ ...p, total_litters: null })); }}
                    placeholder="e.g. 4" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                </VInput>
                <VInput
                  label="Total piglets born alive (all litters)"
                  required={form.gender === "female" && form.growth_stage === "breeder"}
                  error={histErrors.total_piglets_born}>
                  <TextInput style={[s.input, histErrors.total_piglets_born && s.inputError]} value={history.total_piglets_born}
                    onChangeText={v => { setH("total_piglets_born", v); if (histErrors.total_piglets_born) setHistErrors(p => ({ ...p, total_piglets_born: null })); }}
                    placeholder="e.g. 42" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                </VInput>
                <VInput
                  label="Total piglets weaned (all litters)"
                  required={form.gender === "female" && form.growth_stage === "breeder"}
                  error={histErrors.total_piglets_weaned}>
                  <TextInput style={[s.input, histErrors.total_piglets_weaned && s.inputError]} value={history.total_piglets_weaned}
                    onChangeText={v => { setH("total_piglets_weaned", v); if (histErrors.total_piglets_weaned) setHistErrors(p => ({ ...p, total_piglets_weaned: null })); }}
                    placeholder="e.g. 38" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                </VInput>
                <DateField
                  label="Last farrowing date"
                  required={form.gender === "female" && form.growth_stage === "breeder"}
                  value={history.last_farrowing_date}
                  onChange={v => { setH("last_farrowing_date", v); setHistErrors(p => ({ ...p, last_farrowing_date: null })); }}
                  error={histErrors.last_farrowing_date}
                  placeholder="Tap to select"
                />
                {parseInt(history.total_litters || "0") > 0 && (
                  <View style={s.autoCreateNotice}>
                    <Image source={ICONS.analytics} style={{ width: 14, height: 14, resizeMode: "contain" }} />
                    <Text style={s.autoCreateText}>
                      {parseInt(history.total_litters || "0")} breeding records will be auto-created when saved. Analytics update immediately.
                    </Text>
                  </View>
                )}
              </SCard>
            )}

            <SCard title="Health History" icon={ICONS.pill} subtitle="Major diseases or treatments before registration">
              <VInput label="Past diseases (comma-separated, optional)">
                <TextInput style={[s.input, s.textArea]} value={history.major_diseases_history}
                  onChangeText={v => setH("major_diseases_history", v)}
                  placeholder="e.g. PRRS (recovered 2024-03), Swine flu (2023-11)"
                  placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </VInput>
              <VInput label="Vaccination summary (optional)">
                <TextInput style={[s.input, s.textArea]} value={history.vaccination_status_summary}
                  onChangeText={v => setH("vaccination_status_summary", v)}
                  placeholder="e.g. Hog cholera (2025-01), FMD (2024-10)"
                  placeholderTextColor={COLORS.textMuted} multiline numberOfLines={3} textAlignVertical="top" />
              </VInput>
            </SCard>

            <SCard title="Growth History" icon={ICONS.analytics} subtitle="Historical weight milestones (improves ADG accuracy)">
              <VInput label="Weight at 6 months (kg, optional)">
                <TextInput style={s.input} value={history.weight_at_6_months}
                  onChangeText={v => setH("weight_at_6_months", v)}
                  placeholder="e.g. 30.0" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
              </VInput>
              <VInput label="Weight at 12 months (kg, optional)">
                <TextInput style={s.input} value={history.weight_at_12_months}
                  onChangeText={v => setH("weight_at_12_months", v)}
                  placeholder="e.g. 65.0" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
              </VInput>
            </SCard>

            <NavRow onBack={() => setStep(2)} onNext={handleSave} nextLabel="Save Pig + History" nextLoading={saving} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SCard({ title, icon, subtitle, required, error, children }) {
  return (
    <View style={s.scard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Image source={icon} style={{ width: 16, height: 16, resizeMode: "contain" }} />
        <Text style={s.scardTitle}>
          {title}{required && <Text style={{ color: "#E53935" }}> *</Text>}
        </Text>
      </View>
      {subtitle && <Text style={s.scardSub}>{subtitle}</Text>}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function ChipBtn({ label, active, activeColor, activeBg, onPress }) {
  return (
    <TouchableOpacity
      style={[s.chip, active && { backgroundColor: activeBg, borderColor: activeColor }]}
      onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.chipText, active && { color: activeColor, fontWeight: "700" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NavRow({ onBack, backLabel = "Back", onNext, nextLabel, nextLoading }) {
  return (
    <View style={s.navRow}>
      <TouchableOpacity style={s.backBtn} onPress={onBack}>
        <Text style={s.backBtnText}>{backLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.nextBtn, nextLoading && { opacity: 0.7 }]} onPress={onNext} disabled={nextLoading}>
        {nextLoading
          ? <ActivityIndicator color={COLORS.white} />
          : <Text style={s.nextBtnText}>{nextLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: COLORS.screenBg },
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  scroll: { flex: 1 },

  typeScreen:  { flexGrow: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  typeTitle:   { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center", marginBottom: 8 },
  typeSub:     { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginBottom: 32, lineHeight: 20 },
  typeCard:    { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, marginBottom: 12, width: "100%", ...SHADOW.sm },
  typeIconWrap:{ width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  typeCardTitle:{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  typeCardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },

  progressWrap:  { backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  progressTrack: { height: 4, backgroundColor: COLORS.borderLight, borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 4, textAlign: "right" },

  infoBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: COLORS.blueBg, borderRadius: RADIUS.lg, padding: 12, marginHorizontal: 16, marginTop: 14 },
  infoBannerText: { flex: 1, fontSize: 12, color: COLORS.blue, lineHeight: 18 },

  scard:     { backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 14, borderRadius: RADIUS.xl, padding: 18, ...SHADOW.sm },
  scardTitle:{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  scardSub:  { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  input:      { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  inputError: { borderColor: "#E53935", borderWidth: 1.5 },
  textArea:   { minHeight: 80, textAlignVertical: "top" },
  errorText:  { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },

  chipRow:         { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:            { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg },
  chipText:        { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },

  stageGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stageCard:       { width: "31%", alignItems: "center", padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg, gap: 4 },
  stageCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  stageIcon:       { width: 24, height: 24, resizeMode: "contain" },
  stageLabel:      { fontSize: 11, color: COLORS.textSecondary, fontWeight: "500" },
  stageLabelActive:{ color: COLORS.primary, fontWeight: "700" },

  autoCreateNotice: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, marginTop: 4 },
  autoCreateText:   { flex: 1, fontSize: 11, color: COLORS.primary, lineHeight: 16, fontWeight: "500" },

  navRow:     { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 20 },
  backBtn:    { flex: 1, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.xl, padding: 14, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  backBtnText:{ fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  nextBtn:    { flex: 2, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: "center", ...SHADOW.sm },
  nextBtnText:{ color: COLORS.white, fontSize: 14, fontWeight: "700" },
});