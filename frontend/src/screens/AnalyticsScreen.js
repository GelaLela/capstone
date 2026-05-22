import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Dimensions } from "react-native";
import { api } from "../services/api";
 
const SCREEN_W = Dimensions.get("window").width;
 
function BarChart({ data, maxValue, color = "#1D9E75" }) {
  return (
    <View style={chart.wrap}>
      {data.map((item, i) => {
        const pct = maxValue > 0 ? item.value / maxValue : 0;
        return (
          <View key={i} style={chart.col}>
            <Text style={chart.val}>{item.value}</Text>
            <View style={chart.barBg}>
              <View style={[chart.barFill, { height: Math.round(pct * 100) + "%", backgroundColor: color }]} />
            </View>
            <Text style={chart.label}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
 
const chart = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150, paddingTop: 20 },
  col: { flex: 1, alignItems: "center", height: "100%" },
  val: { fontSize: 11, color: "#5F5E5A", fontWeight: "600", marginBottom: 4 },
  barBg: { flex: 1, width: "70%", backgroundColor: "#E8E7E0", borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 4 },
  label: { fontSize: 10, color: "#888780", marginTop: 4, textAlign: "center" },
});

export default function AnalyticsScreen() {
  const [pigs, setPigs] = useState([]);
  const [sowPerf, setSowPerf] = useState([]);
  const [loading, setLoading] = useState(true);
 
  useFocusEffect(
    useCallback(() => {
      api.getPigs().then((d) => setPigs(d.results || d)).catch(console.error).finally(() => setLoading(false));
      api.getSowPerformance().then(setSowPerf).catch(console.error);
    }, [])
  );
 
  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;
 
  const total = pigs.length;
  const stages = ["piglet", "weaner", "grower", "finisher", "breeder"];
  const stageCounts = stages.map((s) => ({
    label: s.charAt(0).toUpperCase() + s.slice(1),
    value: pigs.filter((p) => p.growth_stage === s).length,
  }));
  const healthData = [
    { label: "Healthy",   value: pigs.filter((p) => p.health_status === "healthy").length,         color: "#639922" },
    { label: "Treatment", value: pigs.filter((p) => p.health_status === "under_treatment").length,  color: "#EF9F27" },
    { label: "Critical",  value: pigs.filter((p) => p.health_status === "critical").length,          color: "#E24B4A" },
  ];
  const genderData = [
    { label: "Female", value: pigs.filter((p) => p.gender === "female").length, color: "#D4537E" },
    { label: "Male",   value: pigs.filter((p) => p.gender === "male").length,   color: "#185FA5" },
  ];
  const maxStage  = Math.max(...stageCounts.map((d) => d.value), 1);
  const maxHealth = Math.max(...healthData.map((d) => d.value), 1);
  const avgAge    = total > 0 ? Math.round(pigs.reduce((a, p) => a + (p.age_in_months || 0), 0) / total) : 0;
  const healthRate = total > 0 ? Math.round((healthData[0].value / total) * 100) : 0;
 
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={styles.metricRow}>
        <StatCard label="Total pigs" value={total} />
        <StatCard label="Avg age" value={avgAge + " mo"} />
        <StatCard label="Health rate" value={healthRate + "%"} />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pigs by growth stage</Text>
        <BarChart data={stageCounts} maxValue={maxStage} color="#1D9E75" />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health breakdown</Text>
        <BarChart data={healthData} maxValue={maxHealth} color="#639922" />
        <View style={styles.legendRow}>
          {healthData.map((d) => (
            <View key={d.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: d.color }]} />
              <Text style={styles.legendText}>{d.label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Gender split</Text>
        <View style={styles.genderRow}>
          {genderData.map((g) => (
            <View key={g.label} style={styles.genderCard}>
              <Text style={[styles.genderValue, { color: g.color }]}>{g.value}</Text>
              <Text style={styles.genderLabel}>{g.label}</Text>
              <Text style={styles.genderPct}>{Math.round((g.value / (total || 1)) * 100)}%</Text>
              <View style={styles.genderBar}>
                <View style={[styles.genderFill, { width: Math.round((g.value / (total || 1)) * 100) + "%", backgroundColor: g.color }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>All pigs overview</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Name</Text>
          <Text style={styles.th}>Stage</Text>
          <Text style={styles.th}>Weight</Text>
          <Text style={styles.th}>Status</Text>
        </View>
        {pigs.map((p) => (
          <View key={p.id} style={styles.tableRow}>
            <Text style={[styles.td, { flex: 2, fontWeight: "600" }]}>{p.name}</Text>
            <Text style={styles.td}>{p.growth_stage}</Text>
            <Text style={styles.td}>{p.latest_weight ? p.latest_weight + "kg" : "—"}</Text>
            <Text style={[styles.td, {
              color: p.health_status === "healthy" ? "#3B6D11" :
                     p.health_status === "critical" ? "#A32D2D" : "#854F0B"
            }]}>{p.health_status === "under_treatment" ? "Treat." : p.health_status}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 20 }} />
      {sowPerf.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏆 Sow Performance Ranking</Text>
          <Text style={{ fontSize: 12, color: "#888780", marginBottom: 12 }}>
            Ranked by avg live piglets per litter and survival rate
          </Text>
          {sowPerf.map((sow, i) => {
            const ratingColor = {
              Excellent: "#3B6D11", Good: "#185FA5",
              Average: "#854F0B",   Poor: "#A32D2D",
            }[sow.performance_rating] || "#5F5E5A";

            const ratingBg = {
              Excellent: "#EAF3DE", Good: "#E6F1FB",
              Average: "#FAEEDA",   Poor: "#FCEBEB",
            }[sow.performance_rating] || "#F1EFE8";

            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;

            return (
              <View key={sow.sow_id} style={{
                flexDirection: "row", alignItems: "center",
                paddingVertical: 12, borderBottomWidth: 0.5,
                borderBottomColor: "#E8E7E0", gap: 12,
              }}>
                <Text style={{ fontSize: 20, width: 32 }}>{medal}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#2C2C2A" }}>
                      {sow.sow_name}
                    </Text>
                    <View style={{ backgroundColor: ratingBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: ratingColor }}>
                        {sow.performance_rating}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: "#888780", marginTop: 3 }}>
                    {sow.total_litters} litter(s) · Avg {sow.avg_live_piglets} live piglets · {sow.survival_rate}% survival
                  </Text>
                  <Text style={{ fontSize: 11, color: "#B4B2A9", marginTop: 1 }}>
                    Last farrowed: {sow.last_farrowed}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: ratingColor }}>
                    {sow.avg_live_piglets}
                  </Text>
                  <Text style={{ fontSize: 10, color: "#888780" }}>avg/litter</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
 
function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  metricRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: "#D3D1C7" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#1D9E75" },
  statLabel: { fontSize: 11, color: "#888780", marginTop: 2 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: "#D3D1C7" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2A", marginBottom: 12 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: "#5F5E5A" },
  genderRow: { flexDirection: "row", gap: 12 },
  genderCard: { flex: 1, padding: 14, backgroundColor: "#F8F7F2", borderRadius: 10 },
  genderValue: { fontSize: 28, fontWeight: "700" },
  genderLabel: { fontSize: 13, color: "#5F5E5A", marginTop: 2 },
  genderPct: { fontSize: 12, color: "#888780" },
  genderBar: { height: 6, backgroundColor: "#D3D1C7", borderRadius: 3, marginTop: 8, overflow: "hidden" },
  genderFill: { height: 6, borderRadius: 3 },
  tableHeader: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7", marginBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F0EFE8" },
  th: { flex: 1, fontSize: 11, fontWeight: "700", color: "#888780", textTransform: "uppercase" },
  td: { flex: 1, fontSize: 12, color: "#2C2C2A", textTransform: "capitalize" },
});
