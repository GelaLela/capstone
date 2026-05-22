import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TextInput, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { api } from "../services/api";
 
const STAGES = ["piglet", "weaner", "grower", "finisher", "breeder"];
const GENDERS = ["male", "female"];
const BREEDS = ["Landrace", "Large White", "Duroc", "Philippine Native", "Crossbreed"];
 
export default function AddPigScreen({ navigation }) {
  const [form, setForm] = useState({
    name: "", pig_id: "", date_of_birth: "",
    gender: "female", breed: "Landrace", growth_stage: "piglet", notes: "",
  });
  const [initialWeight, setInitialWeight] = useState("");
  const [saving, setSaving] = useState(false);
 
  function set(field, value) { setForm((prev) => ({ ...prev, [field]: value })); }
 
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
          weight_kg: parseFloat(initialWeight),
          recorded_at: new Date().toISOString().split("T")[0],
          notes: "Initial weight at registration",
        });
      }
      Alert.alert("Success!", form.name + " has been added to the farm.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally { setSaving(false); }
  }
 
  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic info</Text>
        <Field label="Pig name *">
          <TextInput style={styles.input} value={form.name} onChangeText={(v) => set("name", v)}
            placeholder="e.g. Princess" placeholderTextColor="#B4B2A9" />
        </Field>
        <Field label="Pig ID *">
          <TextInput style={styles.input} value={form.pig_id} onChangeText={(v) => set("pig_id", v)}
            placeholder="e.g. P-016" placeholderTextColor="#B4B2A9" />
        </Field>
        <Field label="Date of birth * (YYYY-MM-DD)">
          <TextInput style={styles.input} value={form.date_of_birth}
            onChangeText={(v) => set("date_of_birth", v)}
            placeholder="e.g. 2025-01-15" placeholderTextColor="#B4B2A9"
            keyboardType="numbers-and-punctuation" />
        </Field>
        <Field label="Gender">
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Chip key={g} label={g} active={form.gender === g} onPress={() => set("gender", g)} />
            ))}
          </View>
        </Field>
        <Field label="Breed">
          <View style={styles.chipRow}>
            {BREEDS.map((b) => (
              <Chip key={b} label={b} active={form.breed === b} onPress={() => set("breed", b)} />
            ))}
          </View>
        </Field>
        <Field label="Growth stage">
          <View style={styles.chipRow}>
            {STAGES.map((s) => (
              <Chip key={s} label={s} active={form.growth_stage === s} onPress={() => set("growth_stage", s)} />
            ))}
          </View>
        </Field>
      </View>
 
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Initial weight (optional)</Text>
        <Field label="Weight in kg">
          <TextInput style={styles.input} value={initialWeight} onChangeText={setInitialWeight}
            placeholder="e.g. 7.5" placeholderTextColor="#B4B2A9" keyboardType="decimal-pad" />
        </Field>
      </View>
 
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes (optional)</Text>
        <TextInput style={[styles.input, styles.textArea]} value={form.notes}
          onChangeText={(v) => set("notes", v)}
          placeholder="Any observations..." placeholderTextColor="#B4B2A9"
          multiline numberOfLines={4} />
      </View>
 
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save pig</Text>}
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
 
function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
 
function Chip({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </TouchableOpacity>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  section: {
    backgroundColor: "#fff", marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#D3D1C7",
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#1D9E75", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  field: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: "#5F5E5A", marginBottom: 6, fontWeight: "500" },
  input: {
    backgroundColor: "#F8F7F2", borderRadius: 10,
    padding: 12, fontSize: 14, color: "#2C2C2A",
    borderWidth: 0.5, borderColor: "#D3D1C7",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5, borderColor: "#D3D1C7", backgroundColor: "#F8F7F2" },
  chipActive: { backgroundColor: "#1D9E75", borderColor: "#1D9E75" },
  chipText: { fontSize: 13, color: "#5F5E5A", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  saveBtn: { margin: 16, backgroundColor: "#1D9E75", borderRadius: 14, padding: 16, alignItems: "center" },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
