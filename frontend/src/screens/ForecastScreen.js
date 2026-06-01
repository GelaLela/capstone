import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const TABS = [
  { key: "farrowing", label: "🐣 Farrowing",    short: "Farrowing" },
  { key: "breeding",  label: "🌸 Next Breeding", short: "Breeding"  },
  { key: "adg",       label: "📈 Growth ADG",    short: "ADG"       },
];

export default function ForecastScreen() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState("farrowing");

  useFocusEffect(useCallback(() => {
    api.getBreedingForecast()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []));

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  if (!data || !data.summary) return (
    <View style={s.center}>
      <Text style={{ fontSize: 48, marginBottom: 12 }}>🐷</Text>
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6 }}>
        No forecast data yet
      </Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 40 }}>
        Add breeding records to see farrowing forecasts and ADG analysis.
      </Text>
    </View>
  );

  return (
    <View style={s.screen}>
      {/* Summary bar */}
      <View style={s.summaryBar}>
        <SumCard icon="🤰" label="Pregnant"   value={data.summary.pregnant_sows}           color={COLORS.blue} />
        <SumCard icon="⚠️" label="Due in 7d"  value={data.summary.farrowing_within_7_days} color={COLORS.danger} />
        <SumCard icon="🌸" label="Breed now"  value={data.summary.sows_ready_to_breed}      color={COLORS.primary} />
        <SumCard icon="📈" label="Above ADG"  value={data.summary.pigs_above_adg_benchmark} color={COLORS.healthy} />
      </View>

      {/* Tab pills */}
      <View style={s.tabWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabContent}
        >
          {TABS.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tabPill, tab === t.key && s.tabPillActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabPillText, tab === t.key && s.tabPillTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* FARROWING TAB */}
        {tab === "farrowing" && (
          <>
            <InfoBox text="Based on 114-day gestation rule. Natural variation ±7 days (day 107–121). Overdue only after day 121." />
            {data.farrowing_forecasts.length === 0 && <EmptyState icon="🤰" text="No pregnant sows at the moment" />}
            {data.farrowing_forecasts.map((f, i) => {
              const barColor = f.is_overdue ? COLORS.danger : f.alert ? COLORS.warning : COLORS.primary;
              const statusBg = f.is_overdue ? COLORS.dangerBg : f.alert ? COLORS.warningBg : COLORS.healthyBg;
              const statusText = f.is_overdue ? "Overdue" : f.alert ? "Due soon" : f.pregnancy_status === "bred" ? "Newly bred" : "On track";
              const statusColor = f.is_overdue ? COLORS.danger : f.alert ? COLORS.warning : f.pregnancy_status === "bred" ? COLORS.blue : COLORS.healthy;

              return (
                <View key={i} style={[s.forecastCard, (f.alert || f.is_overdue) && s.forecastCardAlert]}>
                  <View style={s.forecastHeader}>
                    <View style={s.sowAvatarWrap}>
                      <Text style={{ fontSize: 24 }}>🐷</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sowName}>{f.sow_name}</Text>
                      <Text style={s.sowId}>{f.sow_id}</Text>
                    </View>
                    <View style={[s.statusChip, { backgroundColor: statusBg }]}>
                      <Text style={[s.statusChipText, { color: statusColor }]}>{statusText}</Text>
                    </View>
                  </View>

                  <Text style={s.gestStage}>{f.gestation_stage}</Text>

                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: f.gestation_progress_pct + "%", backgroundColor: barColor }]} />
                    </View>
                    <Text style={[s.progressPct, { color: barColor }]}>{f.gestation_progress_pct}%</Text>
                  </View>
                  <Text style={s.progressLabel}>of 114 days gestation</Text>

                  <View style={s.pillGrid}>
                    <InfoPill label="Bred on"    value={f.breeding_date} />
                    <InfoPill label="Expected"   value={f.expected_farrowing} />
                    <InfoPill label="Earliest"   value={f.earliest_farrowing} />
                    <InfoPill label="Latest"     value={f.latest_farrowing} />
                    <InfoPill label="Days pregnant" value={`${f.days_pregnant} days`} />
                    <InfoPill label="Days remaining" value={
                      f.is_overdue ? `${Math.abs(f.days_remaining)} overdue` : `${f.days_remaining} days`
                    } valueColor={f.is_overdue ? COLORS.danger : f.alert ? COLORS.warning : COLORS.textPrimary} />
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* NEXT BREEDING TAB */}
        {tab === "breeding" && (
          <>
            <InfoBox text="Based on 114-day gestation rule (swine reproductive biology standard). Natural variation of ±7 days is normal — earliest possible farrowing is day 107, latest is day 121. Overdue is only flagged after day 121." />
            {data.next_breeding_windows.length === 0 && <EmptyState icon="🌸" text="No recently farrowed sows yet" />}
            {data.next_breeding_windows.map((b, i) => (
              <View key={i} style={[s.forecastCard, b.ready_to_breed && s.forecastCardReady]}>
                <View style={s.forecastHeader}>
                  <View style={[s.sowAvatarWrap, b.ready_to_breed && { backgroundColor: COLORS.primaryLight }]}>
                    <Text style={{ fontSize: 24 }}>{b.ready_to_breed ? "💕" : "🐷"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.sowName}>{b.sow_name}</Text>
                    <Text style={s.sowId}>{b.sow_id}</Text>
                  </View>
                  <View style={[s.statusChip, { backgroundColor: b.ready_to_breed ? COLORS.primaryLight : COLORS.blueBg }]}>
                    <Text style={[s.statusChipText, { color: b.ready_to_breed ? COLORS.primary : COLORS.blue }]}>
                      {b.ready_to_breed ? "Ready ✓" : `${b.days_until_estrus}d`}
                    </Text>
                  </View>
                </View>
                <View style={s.pillGrid}>
                  <InfoPill label="Farrowed on"  value={b.farrowed_on} />
                  <InfoPill label="Weaning date" value={b.weaning_date} />
                  <InfoPill label="Estrus date"  value={b.next_estrus_date} />
                  <InfoPill label="Status"       value={b.status}
                    valueColor={b.ready_to_breed ? COLORS.primary : COLORS.blue} />
                </View>
              </View>
            ))}
          </>
        )}

        {/* ADG TAB */}
        {tab === "adg" && (
          <>
            <InfoBox text="Average Daily Gain vs industry benchmarks: Piglet 0.25 kg/day • Weaner 0.40 • Grower 0.65 • Finisher 0.85 • Breeder 0.20" />
            {data.adg_performance.length === 0 && <EmptyState icon="📈" text="Need at least 2 weight records per pig to calculate ADG" />}
            {data.adg_performance.map((a, i) => {
              const pct = Math.min(100, a.performance_vs_benchmark_pct);
              const color = a.status === "Above benchmark" ? COLORS.healthy : a.status === "Below benchmark" ? COLORS.danger : COLORS.warning;
              const bg    = a.status === "Above benchmark" ? COLORS.healthyBg : a.status === "Below benchmark" ? COLORS.dangerBg : COLORS.warningBg;
              return (
                <View key={i} style={s.adgCard}>
                  <View style={s.forecastHeader}>
                    <View style={s.sowAvatarWrap}>
                      <Text style={{ fontSize: 22 }}>🐷</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sowName}>{a.pig_name}</Text>
                      <Text style={s.sowId}>{a.pig_id}  •  {a.growth_stage}</Text>
                    </View>
                    <View style={[s.statusChip, { backgroundColor: bg }]}>
                      <Text style={[s.statusChipText, { color }]}>
                        {a.status === "Above benchmark" ? "Above ↑" : a.status === "Below benchmark" ? "Below ↓" : "Near ≈"}
                      </Text>
                    </View>
                  </View>

                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: pct + "%", backgroundColor: color }]} />
                    </View>
                    <Text style={[s.progressPct, { color }]}>{pct.toFixed(0)}%</Text>
                  </View>

                  <View style={s.pillGrid}>
                    <InfoPill label="Current weight"  value={`${a.current_weight} kg`} />
                    <InfoPill label="ADG"             value={`${a.adg_kg_per_day} kg/day`} />
                    <InfoPill label="Benchmark"       value={`${a.benchmark_kg_per_day} kg/day`} />
                    <InfoPill label="Performance"     value={`${a.performance_vs_benchmark_pct}%`} valueColor={color} />
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

function SumCard({ icon, label, value, color }) {
  return (
    <View style={s.sumCard}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

function InfoBox({ text }) {
  return (
    <View style={s.infoBox}>
      <Text style={s.infoBoxText}>ℹ️  {text}</Text>
    </View>
  );
}

function InfoPill({ label, value, valueColor }) {
  return (
    <View style={s.infoPill}>
      <Text style={s.infoPillLabel}>{label}</Text>
      <Text style={[s.infoPillValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function EmptyState({ icon, text }) {
  return (
    <View style={s.emptyState}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  summaryBar: { flexDirection: "row", backgroundColor: COLORS.white, padding: 14, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOW.sm },
  sumCard:    { flex: 1, alignItems: "center", gap: 2 },
  sumValue:   { fontSize: 20, fontWeight: "800" },
  sumLabel:   { fontSize: 9, color: COLORS.textMuted, textAlign: "center" },

  tabWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  tabContent: {
    paddingHorizontal: 12,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  tabPill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.screenBg,
    justifyContent: "center",
    alignItems: "center",
  },
  tabPillActive:    { backgroundColor: COLORS.primary },
  tabPillText:      { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  tabPillTextActive:{ color: COLORS.white, fontWeight: "700" },

  forecastCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  forecastCardAlert: { borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  forecastCardReady: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  adgCard:           { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },

  forecastHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sowAvatarWrap:  { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  sowName:        { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  sowId:          { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontFamily: "monospace" },
  statusChip:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  statusChipText: { fontSize: 12, fontWeight: "700" },

  gestStage:    { fontSize: 12, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 8 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  progressBg:   { flex: 1, height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressPct:  { fontSize: 12, fontWeight: "700", minWidth: 36, textAlign: "right" },
  progressLabel:{ fontSize: 11, color: COLORS.textMuted, marginBottom: 12 },

  pillGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoPill:   { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10, minWidth: "45%", flex: 1 },
  infoPillLabel:{ fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  infoPillValue:{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },

  infoBox:     { backgroundColor: COLORS.blueBg, borderRadius: RADIUS.lg, padding: 12, borderLeftWidth: 3, borderLeftColor: COLORS.blue },
  infoBoxText: { fontSize: 12, color: COLORS.blue, lineHeight: 18 },

  emptyState: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyText:  { fontSize: 14, color: COLORS.textMuted, textAlign: "center" },
});