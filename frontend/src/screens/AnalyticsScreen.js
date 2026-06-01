import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function AnalyticsScreen() {
  const SCREEN_W = Dimensions.get("window").width - 64;
  const [pigs, setPigs]       = useState([]);
  const [sowPerf, setSowPerf] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState("This Month");

  useFocusEffect(useCallback(() => {
    api.getPigs()
      .then(p => setPigs(p.results || p))
      .catch(console.error)
      .finally(() => setLoading(false));

    api.getSowPerformance()
      .then(sp => setSowPerf(sp || []))
      .catch(() => setSowPerf([])); // silently fail if no data
  }, []));

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  const total    = pigs.length;
  const healthy  = pigs.filter(p => p.health_status === "healthy").length;
  const sick     = pigs.filter(p => p.health_status === "under_treatment").length;
  const critical = pigs.filter(p => p.health_status === "critical").length;
  const female   = pigs.filter(p => p.gender === "female").length;
  const male     = pigs.filter(p => p.gender === "male").length;
  const avgAge   = total > 0 ? Math.round(pigs.reduce((a, p) => a + (p.age_in_months || 0), 0) / total) : 0;
  const healthRate = total > 0 ? Math.round((healthy / total) * 100) : 0;

  const stages = ["piglet","weaner","grower","finisher","breeder"];
  const stageCounts = stages.map(s => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    value: pigs.filter(p => p.growth_stage === s).length,
    color: { piglet: COLORS.purple, weaner: COLORS.amber, grower: COLORS.primary, finisher: COLORS.blue, breeder: COLORS.pink }[s],
  }));
  const maxStage = Math.max(...stageCounts.map(d => d.value), 1);

  const healthData = [
    { label: "Healthy",   value: healthy,  pct: total > 0 ? (healthy/total*100).toFixed(1) : 0,  color: COLORS.healthy, icon: "💚" },
    { label: "Sick",      value: sick,     pct: total > 0 ? (sick/total*100).toFixed(1) : 0,     color: COLORS.warning, icon: "🟡" },
    { label: "Under Obs.",value: sick,     pct: total > 0 ? (sick/total*100).toFixed(1) : 0,     color: COLORS.warning, icon: "🟡" },
    { label: "Critical",  value: critical, pct: total > 0 ? (critical/total*100).toFixed(1) : 0, color: COLORS.danger,  icon: "🔴" },
  ].filter((d, i, arr) => i === 0 || arr[i].label !== arr[i-1].label);

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

      {/* Period selector */}
      <View style={s.periodRow}>
        <Text style={s.pageTitle}>Analytics</Text>
        <TouchableOpacity style={s.periodBtn}>
          <Text style={s.periodBtnText}>{period} ▾</Text>
        </TouchableOpacity>
      </View>

      {/* KPI cards */}
      <View style={s.kpiGrid}>
        <KpiCard icon="🐷" label="Total Pigs"   value={total}         color={COLORS.primary} bg={COLORS.primaryLight} />
        <KpiCard icon="📅" label="Avg Age"       value={`${avgAge} mo`} color={COLORS.blue}   bg={COLORS.blueBg} />
        <KpiCard icon="💚" label="Health Rate"   value={`${healthRate}%`} color={COLORS.healthy} bg={COLORS.healthyBg} />
        <KpiCard icon="♀"  label="Female"        value={female}        color={COLORS.pink}    bg="#FDF2F8" />
      </View>

      {/* Health breakdown — donut style */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Health Breakdown</Text>
        <View style={s.healthBreakdown}>
          {/* Donut placeholder with total */}
          <View style={s.donutWrap}>
            <View style={s.donut}>
              <Text style={s.donutTotal}>{total}</Text>
              <Text style={s.donutLabel}>Total</Text>
            </View>
            {/* Colored arcs simulated with stacked rings */}
            <View style={[s.donutRing, { borderColor: COLORS.healthy }]} />
          </View>

          {/* Legend */}
          <View style={s.healthLegend}>
            {[
              { label: "Healthy",    value: healthy,  pct: total > 0 ? Math.round(healthy/total*100) : 0,  color: COLORS.healthy },
              { label: "Sick",       value: sick,     pct: total > 0 ? Math.round(sick/total*100) : 0,     color: COLORS.warning },
              { label: "Under Obs.", value: sick,     pct: total > 0 ? Math.round(sick/total*100) : 0,     color: COLORS.amber   },
              { label: "Critical",   value: critical, pct: total > 0 ? Math.round(critical/total*100) : 0, color: COLORS.danger  },
            ].filter((item, index, self) => index === self.findIndex(i => i.label === item.label))
             .map((item, i) => (
              <View key={i} style={s.legendRow}>
                <View style={[s.legendDot, { backgroundColor: item.color }]} />
                <Text style={s.legendLabel}>{item.label}</Text>
                <Text style={s.legendCount}>({item.value})</Text>
                <Text style={[s.legendPct, { color: item.color }]}>{item.pct}%</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Stage bar chart */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Pigs by Growth Stage</Text>
        <View style={s.barChart}>
          {stageCounts.map((item, i) => {
            const barH = maxStage > 0 ? Math.round((item.value / maxStage) * 100) : 0;
            return (
              <View key={i} style={s.barCol}>
                <Text style={s.barVal}>{item.value}</Text>
                <View style={s.barBg}>
                  <View style={[s.barFill, { height: barH + "%", backgroundColor: item.color }]} />
                </View>
                <Text style={[s.barLabel, { color: item.color }]}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Gender split */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Gender Split</Text>
        <View style={s.genderRow}>
          <GenderCard icon="♀" label="Female" value={female} total={total} color={COLORS.pink} bg="#FDF2F8" />
          <GenderCard icon="♂" label="Male"   value={male}   total={total} color={COLORS.blue} bg={COLORS.blueBg} />
        </View>
      </View>

      {/* Sow performance ranking */}
      {sowPerf.length > 0 && (
        <View style={s.card}>
          <Text style={s.cardTitle}>🏆 Sow Performance Ranking</Text>
          <Text style={s.cardSub}>Ranked by avg live piglets per litter</Text>
          {sowPerf.map((sow, i) => {
            const rColor = { Excellent: COLORS.healthy, Good: COLORS.blue, Average: COLORS.warning, Poor: COLORS.danger }[sow.performance_rating] || COLORS.textMuted;
            const rBg    = { Excellent: COLORS.healthyBg, Good: COLORS.blueBg, Average: COLORS.warningBg, Poor: COLORS.dangerBg }[sow.performance_rating] || COLORS.screenBg;
            const medal  = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
            return (
              <View key={sow.sow_id} style={s.rankRow}>
                <Text style={s.rankMedal}>{medal}</Text>
                <View style={s.rankAvatar}>
                  <Text style={{ fontSize: 18 }}>🐷</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={s.rankName}>{sow.sow_name}</Text>
                    <View style={[s.ratingBadge, { backgroundColor: rBg }]}>
                      <Text style={[s.ratingText, { color: rColor }]}>{sow.performance_rating}</Text>
                    </View>
                  </View>
                  <Text style={s.rankDetail}>
                    {sow.total_litters} litter(s)  •  Avg {sow.avg_live_piglets} live  •  {sow.survival_rate}% survival
                  </Text>
                </View>
                <View style={s.rankScore}>
                  <Text style={[s.rankScoreVal, { color: rColor }]}>{sow.avg_live_piglets}</Text>
                  <Text style={s.rankScoreLabel}>avg/litter</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Full pig table */}
      <View style={s.card}>
        <Text style={s.cardTitle}>All Pigs Overview</Text>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 2 }]}>Name</Text>
          <Text style={s.th}>Stage</Text>
          <Text style={s.th}>Weight</Text>
          <Text style={s.th}>Status</Text>
        </View>
        {pigs.map(p => {
          const statusColor = p.health_status === "healthy" ? COLORS.healthy : p.health_status === "critical" ? COLORS.danger : COLORS.warning;
          return (
            <View key={p.id} style={s.tableRow}>
              <View style={[{ flex: 2 }, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                <Text style={{ fontSize: 14 }}>🐷</Text>
                <Text style={[s.td, { fontWeight: "700" }]} numberOfLines={1}>{p.name}</Text>
              </View>
              <Text style={s.td}>{p.growth_stage?.slice(0,4)}.</Text>
              <Text style={[s.td, { fontWeight: "600" }]}>{p.latest_weight ? p.latest_weight+"kg" : "—"}</Text>
              <View style={[s.statusDot2, { backgroundColor: statusColor }]} />
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function KpiCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.kpiCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function GenderCard({ icon, label, value, total, color, bg }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={[s.genderCard, { backgroundColor: bg }]}>
      <Text style={[s.genderIcon, { color }]}>{icon}</Text>
      <Text style={[s.genderValue, { color }]}>{value}</Text>
      <Text style={s.genderLabel}>{label}</Text>
      <Text style={s.genderPct}>{pct}%</Text>
      <View style={s.genderBarBg}>
        <View style={[s.genderBarFill, { width: pct + "%", backgroundColor: color }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  periodRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pageTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  periodBtn: { backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  periodBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "47%", borderRadius: RADIUS.xl, padding: 14, ...SHADOW.sm },
  kpiValue:{ fontSize: 24, fontWeight: "800" },
  kpiLabel:{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  card:    { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardTitle:{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 4 },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: 12 },

  // Health donut
  healthBreakdown: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 12 },
  donutWrap: { width: 110, height: 110, justifyContent: "center", alignItems: "center" },
  donut:     { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.screenBg, justifyContent: "center", alignItems: "center", borderWidth: 12, borderColor: COLORS.healthy },
  donutTotal:{ fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  donutLabel:{ fontSize: 10, color: COLORS.textMuted },
  donutRing: { position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: "transparent" },
  healthLegend: { flex: 1, gap: 8 },
  legendRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot:    { width: 10, height: 10, borderRadius: 5 },
  legendLabel:  { flex: 1, fontSize: 12, color: COLORS.textPrimary },
  legendCount:  { fontSize: 12, color: COLORS.textMuted },
  legendPct:    { fontSize: 13, fontWeight: "700", minWidth: 36, textAlign: "right" },

  // Bar chart
  barChart: { flexDirection: "row", gap: 8, height: 140, alignItems: "flex-end", marginTop: 12 },
  barCol:   { flex: 1, alignItems: "center", height: "100%" },
  barVal:   { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 4 },
  barBg:    { flex: 1, width: "80%", backgroundColor: COLORS.borderLight, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  barFill:  { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 9, marginTop: 5, fontWeight: "600", textAlign: "center" },

  // Gender
  genderRow:    { flexDirection: "row", gap: 12, marginTop: 8 },
  genderCard:   { flex: 1, borderRadius: RADIUS.xl, padding: 16 },
  genderIcon:   { fontSize: 28, fontWeight: "800", marginBottom: 4 },
  genderValue:  { fontSize: 28, fontWeight: "800" },
  genderLabel:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  genderPct:    { fontSize: 12, color: COLORS.textMuted },
  genderBarBg:  { height: 4, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 2, marginTop: 8, overflow: "hidden" },
  genderBarFill:{ height: 4, borderRadius: 2 },

  // Sow ranking
  rankRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  rankMedal:  { fontSize: 20, width: 28 },
  rankAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  rankName:   { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  ratingBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  ratingText: { fontSize: 10, fontWeight: "700" },
  rankDetail: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  rankScore:  { alignItems: "center" },
  rankScoreVal:{ fontSize: 18, fontWeight: "800" },
  rankScoreLabel:{ fontSize: 9, color: COLORS.textMuted },

  // Table
  tableHeader: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  tableRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  th:          { flex: 1, fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase" },
  td:          { flex: 1, fontSize: 12, color: COLORS.textPrimary },
  statusDot2:  { width: 10, height: 10, borderRadius: 5 },
});