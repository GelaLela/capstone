import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";

export default function ForecastScreen() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState("farrowing");

  useFocusEffect(
    useCallback(() => {
      api.getBreedingForecast()
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) return (
    <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />
  );

  const TABS = [
    { key: "farrowing", label: "🐣 Farrowing" },
    { key: "breeding",  label: "🌸 Next Breeding" },
    { key: "adg",       label: "📈 Growth ADG" },
  ];

  return (
    <View style={s.container}>
      {/* Summary bar */}
      <View style={s.summaryRow}>
        <SumCard label="Pregnant"   value={data.summary.pregnant_sows}              color="#185FA5" />
        <SumCard label="Due in 7d"  value={data.summary.farrowing_within_7_days}    color="#E24B4A" />
        <SumCard label="Breed now"  value={data.summary.sows_ready_to_breed}         color="#1D9E75" />
        <SumCard label="Above ADG"  value={data.summary.pigs_above_adg_benchmark}   color="#639922" />
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>

        {/* ── FARROWING FORECAST ────────────────────────────────── */}
        {tab === "farrowing" && (
          <>
            <InfoBox text="Based on 114-day gestation rule (swine reproductive biology standard). Gestation stages follow established biological milestones." />
            {data.farrowing_forecasts.length === 0 && (
              <EmptyState text="No pregnant sows at the moment." />
            )}
            {data.farrowing_forecasts.map((f, i) => (
              <View key={i} style={[s.card, f.alert && s.cardAlert, f.is_overdue && s.cardOverdue]}>
                <View style={s.cardHeader}>
                  <Text style={s.cardName}>{f.sow_name}</Text>
                  <Text style={s.cardId}>{f.sow_id}</Text>
                  {f.is_overdue && <Badge label="OVERDUE" color="#A32D2D" bg="#FCEBEB" />}
                  {f.alert && !f.is_overdue && <Badge label="Due soon" color="#854F0B" bg="#FAEEDA" />}
                </View>

                {/* Gestation progress bar */}
                <Text style={s.stageText}>{f.gestation_stage}</Text>
                <View style={s.progressBg}>
                  <View style={[s.progressFill, {
                    width: f.gestation_progress_pct + "%",
                    backgroundColor: f.is_overdue ? "#E24B4A" : f.alert ? "#EF9F27" : "#1D9E75",
                  }]} />
                </View>
                <Text style={s.progressLabel}>{f.gestation_progress_pct}% of 114 days</Text>

                <View style={s.infoGrid}>
                  <InfoPill label="Bred on"         value={f.breeding_date} />
                  <InfoPill label="Expected"        value={f.expected_farrowing} />
                  <InfoPill label="Earliest possible" value={f.earliest_farrowing} />
                  <InfoPill label="Latest possible"   value={f.latest_farrowing} />
                  <InfoPill label="Days pregnant"   value={f.days_pregnant + " days"} />
                  <InfoPill label="Days remaining"  value={
                    f.is_overdue
                      ? "Overdue (past " + f.latest_farrowing + ")"
                      : f.days_remaining + " days to expected"
                  } />
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── NEXT BREEDING WINDOW ──────────────────────────────── */}
        {tab === "breeding" && (
          <>
            <InfoBox text="Based on 114-day gestation rule (swine reproductive biology standard). Natural variation of ±7 days is normal — earliest possible farrowing is day 107, latest is day 121. Overdue is only flagged after day 121." />
            {data.next_breeding_windows.length === 0 && (
              <EmptyState text="No recently farrowed sows yet." />
            )}
            {data.next_breeding_windows.map((b, i) => (
              <View key={i} style={[s.card, b.ready_to_breed && s.cardAlert]}>
                <View style={s.cardHeader}>
                  <Text style={s.cardName}>{b.sow_name}</Text>
                  <Text style={s.cardId}>{b.sow_id}</Text>
                  {b.ready_to_breed
                    ? <Badge label="Ready to breed" color="#3B6D11" bg="#EAF3DE" />
                    : <Badge label={b.status} color="#185FA5" bg="#E6F1FB" />
                  }
                </View>
                <View style={s.infoGrid}>
                  <InfoPill label="Farrowed on"   value={b.farrowed_on} />
                  <InfoPill label="Weaning date"  value={b.weaning_date} />
                  <InfoPill label="Estrus date"   value={b.next_estrus_date} />
                  <InfoPill label="Status"        value={b.status} />
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── ADG PERFORMANCE ──────────────────────────────────── */}
        {tab === "adg" && (
          <>
            <InfoBox text="Average Daily Gain (ADG) compared against industry benchmarks: Piglet 0.25 kg/day · Weaner 0.40 · Grower 0.65 · Finisher 0.85 · Breeder 0.20" />
            {data.adg_performance.length === 0 && (
              <EmptyState text="Need at least 2 weight records per pig to calculate ADG." />
            )}
            {data.adg_performance.map((a, i) => {
              const color = a.status === "Above benchmark" ? "#3B6D11"
                          : a.status === "Below benchmark" ? "#A32D2D"
                          : "#854F0B";
              const bg    = a.status === "Above benchmark" ? "#EAF3DE"
                          : a.status === "Below benchmark" ? "#FCEBEB"
                          : "#FAEEDA";
              return (
                <View key={i} style={s.card}>
                  <View style={s.cardHeader}>
                    <Text style={s.cardName}>{a.pig_name}</Text>
                    <Text style={s.cardId}>{a.pig_id}</Text>
                    <Badge label={a.status} color={color} bg={bg} />
                  </View>
                  <View style={s.progressBg}>
                    <View style={[s.progressFill, {
                      width: Math.min(100, a.performance_vs_benchmark_pct) + "%",
                      backgroundColor: color,
                    }]} />
                  </View>
                  <Text style={s.progressLabel}>
                    {a.adg_kg_per_day} kg/day vs benchmark {a.benchmark_kg_per_day} kg/day
                    ({a.performance_vs_benchmark_pct}%)
                  </Text>
                  <View style={s.infoGrid}>
                    <InfoPill label="Stage"          value={a.growth_stage} />
                    <InfoPill label="Current weight" value={a.current_weight + " kg"} />
                    <InfoPill label="ADG"            value={a.adg_kg_per_day + " kg/day"} />
                    <InfoPill label="Benchmark"      value={a.benchmark_kg_per_day + " kg/day"} />
                  </View>
                </View>
              );
            })}
          </>
        )}

      </ScrollView>
    </View>
  );
}

function SumCard({ label, value, color }) {
  return (
    <View style={s.sumCard}>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}
function Badge({ label, color, bg }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}
function InfoPill({ label, value }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillLabel}>{label}</Text>
      <Text style={s.pillValue}>{value}</Text>
    </View>
  );
}
function InfoBox({ text }) {
  return (
    <View style={s.infoBox}>
      <Text style={s.infoBoxText}>ℹ  {text}</Text>
    </View>
  );
}
function EmptyState({ text }) {
  return <Text style={{ color: "#B4B2A9", textAlign: "center", marginTop: 30 }}>{text}</Text>;
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F8F7F2" },
  summaryRow:   { flexDirection: "row", padding: 12, gap: 8, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  sumCard:      { flex: 1, alignItems: "center" },
  sumValue:     { fontSize: 20, fontWeight: "700" },
  sumLabel:     { fontSize: 10, color: "#888780", marginTop: 1, textAlign: "center" },
  tabRow:       { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  tab:          { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: "#1D9E75" },
  tabText:      { fontSize: 12, color: "#888780", fontWeight: "500" },
  tabTextActive:{ color: "#1D9E75", fontWeight: "700" },
  card:         { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#D3D1C7" },
  cardAlert:    { borderColor: "#EF9F27", borderWidth: 1.5 },
  cardOverdue:  { borderColor: "#E24B4A", borderWidth: 1.5 },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  cardName:     { fontSize: 15, fontWeight: "700", color: "#2C2C2A", flex: 1 },
  cardId:       { fontSize: 12, color: "#888780", fontFamily: "monospace" },
  stageText:    { fontSize: 12, color: "#5F5E5A", marginBottom: 6, fontStyle: "italic" },
  progressBg:   { height: 8, backgroundColor: "#E8E7E0", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressLabel:{ fontSize: 11, color: "#888780", marginTop: 4, marginBottom: 10 },
  infoGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  pill:         { backgroundColor: "#F8F7F2", borderRadius: 8, padding: 8, minWidth: "45%" },
  pillLabel:    { fontSize: 10, color: "#888780", marginBottom: 2 },
  pillValue:    { fontSize: 13, fontWeight: "600", color: "#2C2C2A" },
  badge:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText:    { fontSize: 11, fontWeight: "600" },
  infoBox:      { backgroundColor: "#E6F1FB", borderRadius: 8, padding: 12, borderLeftWidth: 3, borderLeftColor: "#378ADD" },
  infoBoxText:  { fontSize: 12, color: "#185FA5", lineHeight: 18 },
});