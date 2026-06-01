import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, KeyboardAvoidingView,
  TextInput, TouchableOpacity, Alert, ActivityIndicator, Platform,
} from "react-native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const STAGES  = ["piglet", "weaner", "grower", "finisher", "breeder"];
const GENDERS = ["female", "male"];
const BREEDS  = ["Landrace", "Large White", "Duroc", "Philippine Native", "Crossbreed"];

export default function AddPigScreen({ navigation }) {
  const [form, setForm] = useState({
    name: "", pig_id: "", date_of_birth: "",
    gender: "female", breed: "Landrace", growth_stage: "piglet", notes: "",
  });
  const [initialWeight, setInitialWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const pigIdRef  = useRef();
  const dobRef    = useRef();
  const weightRef = useRef();
  const notesRef  = useRef();

  function set(field, value) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSave() {
    if (!form.name || !form.pig_id || !form.date_of_birth) {
      Alert.alert("Missing fields", "Please fill in name, ID, and date of birth.");
      return;
    }
    setSaving(true);
    try {
      const pig = await api.createPig(form);
      if (initialWeight) {
        await api.logWeight(pig.id, {
          weight_kg:   parseFloat(initialWeight),
          recorded_at: new Date().toISOString().split("T")[0],
          notes:       "Initial weight at registration",
        });
      }
      Alert.alert("Success! 🐷", `${form.name} has been added to the farm.`, [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  }

  return (
    /*
     * KeyboardAvoidingView fix:
     * - iOS:     behavior="padding"  — adds bottom padding equal to keyboard height
     *            so the ScrollView shrinks and the focused input stays visible.
     * - Android: behavior="height"   — shrinks the view height by keyboard height.
     *            This works correctly inside a stack navigator on Android Expo.
     * keyboardVerticalOffset accounts for the stack navigator header (~56 dp).
     * ScrollView with keyboardShouldPersistTaps="handled" lets the user tap
     * buttons (e.g. Save) without the keyboard auto-dismissing first.
     */
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <ScrollView
        style={s.screen}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Basic info */}
        <SectionCard title="🐷 Basic Info" subtitle="Enter the pig's identification details">
          <Field label="Pig name *">
            <TextInput
              style={s.input}
              value={form.name}
              onChangeText={v => set("name", v)}
              placeholder="e.g. Princess"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => pigIdRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>
          <Field label="Pig ID *">
            <TextInput
              ref={pigIdRef}
              style={s.input}
              value={form.pig_id}
              onChangeText={v => set("pig_id", v)}
              placeholder="e.g. P-016"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="next"
              onSubmitEditing={() => dobRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>
          <Field label="Date of birth * (YYYY-MM-DD)">
            <TextInput
              ref={dobRef}
              style={s.input}
              value={form.date_of_birth}
              onChangeText={v => set("date_of_birth", v)}
              placeholder="e.g. 2025-01-15"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />
          </Field>
        </SectionCard>

        {/* Gender */}
        <SectionCard title="⚧ Gender">
          <View style={s.chipRow}>
            {GENDERS.map(g => (
              <ChipBtn
                key={g}
                label={g === "female" ? "♀  Female" : "♂  Male"}
                active={form.gender === g}
                activeColor={g === "female" ? COLORS.pink : COLORS.blue}
                activeBg={g === "female" ? "#FCE7F3" : COLORS.blueBg}
                onPress={() => set("gender", g)}
              />
            ))}
          </View>
        </SectionCard>

        {/* Breed */}
        <SectionCard title="🧬 Breed">
          <View style={s.chipRow}>
            {BREEDS.map(b => (
              <ChipBtn
                key={b}
                label={b}
                active={form.breed === b}
                activeColor={COLORS.primary}
                activeBg={COLORS.primaryLight}
                onPress={() => set("breed", b)}
              />
            ))}
          </View>
        </SectionCard>

        {/* Growth stage */}
        <SectionCard title="📈 Growth Stage">
          <View style={s.stageGrid}>
            {STAGES.map(stage => {
              const icons = { piglet: "🐣", weaner: "🐷", grower: "🐖", finisher: "🥩", breeder: "🌸" };
              const active = form.growth_stage === stage;
              return (
                <TouchableOpacity
                  key={stage}
                  style={[s.stageCard, active && s.stageCardActive]}
                  onPress={() => set("growth_stage", stage)}
                  activeOpacity={0.8}
                >
                  <Text style={s.stageIcon}>{icons[stage]}</Text>
                  <Text style={[s.stageLabel, active && s.stageLabelActive]}>
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {/* Initial weight */}
        <SectionCard title="⚖️ Initial Weight" subtitle="Optional — can be logged later">
          <Field label="Weight in kg">
            <TextInput
              ref={weightRef}
              style={s.input}
              value={initialWeight}
              onChangeText={setInitialWeight}
              placeholder="e.g. 7.5"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => notesRef.current?.focus()}
              blurOnSubmit={false}
            />
          </Field>
        </SectionCard>

        {/* Notes */}
        <SectionCard title="📝 Notes" subtitle="Optional observations">
          <TextInput
            ref={notesRef}
            style={[s.input, s.textArea]}
            value={form.notes}
            onChangeText={v => set("notes", v)}
            placeholder="Any observations about this pig..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            returnKeyType="done"
          />
        </SectionCard>

        {/* Save button */}
        <View style={s.saveBtnWrap}>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={s.saveBtnText}>🐷  Save Pig</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionTitle}>{title}</Text>
      {subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  );
}

function Field({ label, children }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipBtn({ label, active, activeColor, activeBg, onPress }) {
  return (
    <TouchableOpacity
      style={[s.chip, active && { backgroundColor: activeBg, borderColor: activeColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.chipText, active && { color: activeColor, fontWeight: "700" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: COLORS.screenBg },
  screen: { flex: 1, backgroundColor: COLORS.screenBg },

  sectionCard:  { backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 14, borderRadius: RADIUS.xl, padding: 18, ...SHADOW.sm },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  sectionSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  field:      { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 6 },
  input:      { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  textArea:   { height: 100, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip:    { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg },
  chipText:{ fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },

  stageGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stageCard:       { width: "31%", alignItems: "center", padding: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.screenBg },
  stageCardActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  stageIcon:       { fontSize: 24, marginBottom: 4 },
  stageLabel:      { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  stageLabelActive:{ color: COLORS.primary, fontWeight: "700" },

  saveBtnWrap: { marginHorizontal: 16, marginTop: 20 },
  saveBtn:     { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 16, alignItems: "center", ...SHADOW.md },
  saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});