/**
 * frontend/src/screens/FarmerAnalyticsScreen.js
 *
 * Full analytics dashboard for a single farmer.
 * Navigated to from AdminDashboardScreen with: navigation.navigate("FarmerAnalytics", { farmer })
 *
 * Charts are built with pure React Native Views (no external chart library needed).
 * This avoids compatibility issues with Expo.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function FarmerAnalyticsScreen({ route }) {
  const { farmer } = route.params;
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("pigs"); // pigs | health | breeding | feed

  useFocusEffect(useCallback(() => {
    loadAnalytics();
  }, []));

  async function loadAnalytics() {
    setLoading(true);
    try {
      const result = await api.getFarmerAnalytics(farmer.id);
      console.log("Farmer analytics loaded:", result?.profile?.full_name);
      setData(result);
    } catch (e) {
      console.error("Analytics load error:", e);
      Alert.alert("Error", "Could not load farmer analytics: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Loading analytics...</Text>
    </View>
  );

  if (!data) return (
    <View style={s.center}>
      <Text style={{ fontSize: 40 }}>📊</Text>
      <Text style={s.emptyTitle}>No data available</Text>
    </View>
  );

  const { profile, pig_summary, stage_breakdown, gender_breakdown,
          weight_trend, health_summary, vaccination_summary,
          breeding_summary, feed_summary, feed_weekly_usage, predictions } = data;

  const TABS = [
    { key: "pigs",     label: "🐷 Pigs"     },
    { key: "health",   label: "🩺 Health"   },
    { key: "breeding", label: "🌸 Breeding" },
    { key: "feed",     label: "📦 Feed"     },
  ];

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>

      {/* Farmer profile card */}
      <View style={s.profileCard}>
        <View style={s.profileAvatar}>
          <Text style={{ fontSize: 36 }}>👨‍🌾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.profileName}>{profile.full_name}</Text>
            <View style={[s.statusBadge,
              { backgroundColor: profile.is_active ? COLORS.healthyBg : COLORS.dangerBg }]}>
              <Text style={[s.statusText,
                { color: profile.is_active ? COLORS.healthy : COLORS.danger }]}>
                {profile.is_active ? "Active" : "Disabled"}
              </Text>
            </View>
          </View>
          <Text style={s.profileMeta}>@{profile.username}</Text>
          <Text style={s.profileMeta}>🏠 {profile.farm_name}</Text>
          <Text style={s.profileMeta}>📅 Joined {profile.date_joined}</Text>
          <Text style={s.profileMeta}>🕒 Last login: {profile.last_login}</Text>
        </View>
      </View>

      {/* Headline KPIs */}
      <View style={s.kpiRow}>
        <KPI icon="🐷" value={pig_summary.total}    label="Total Pigs"  color={COLORS.primary} />
        <KPI icon="❤️" value={pig_summary.healthy}  label="Healthy"     color={COLORS.healthy} />
        <KPI icon="🤒" value={pig_summary.sick}      label="Sick"        color={COLORS.warning} />
        <KPI icon="🌸" value={pig_summary.pregnant}  label="Pregnant"    color={COLORS.pink}    />
      </View>

      {/* Predictions */}
      <View style={s.section}>
        <SectionHeader title="🔮 Predictions & Forecast" />
        <View style={s.predictionGrid}>
          <PredCard icon="🐷" label="Pig population next month"
            value={predictions.predicted_pig_population ?? "—"} color={COLORS.primary} bg={COLORS.primaryLight} />
          <PredCard icon="🐣" label="New piglets expected"
            value={predictions.predicted_new_piglets ?? 0} color={COLORS.purple} bg={COLORS.purpleBg} />
          <PredCard icon="📦" label="Feed needed next month"
            value={predictions.predicted_monthly_feed_kg ? `${predictions.predicted_monthly_feed_kg} kg` : "—"}
            color={COLORS.amber} bg={COLORS.amberBg} />
          <PredCard icon="⏳" label="Feed days remaining"
            value={predictions.feed_days_remaining ? `${predictions.feed_days_remaining} days` : "Unlimited"}
            color={predictions.feed_days_remaining && predictions.feed_days_remaining < 7 ? COLORS.danger : COLORS.healthy}
            bg={predictions.feed_days_remaining && predictions.feed_days_remaining < 7 ? COLORS.dangerBg : COLORS.healthyBg} />
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tabBtn, tab === t.key && s.tabBtnActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[s.tabBtnText, tab === t.key && s.tabBtnTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PIG TAB ──────────────────────────────────────────────────────── */}
      {tab === "pigs" && (
        <View style={s.tabContent}>

          {/* Health status donut-style summary */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Health Status Breakdown</Text>
            <View style={s.statusBars}>
              <StatusBar label="Healthy"       value={pig_summary.healthy}  total={pig_summary.total} color={COLORS.healthy} />
              <StatusBar label="Under Obs."    value={pig_summary.sick - pig_summary.critical} total={pig_summary.total} color={COLORS.warning} />
              <StatusBar label="Critical"      value={pig_summary.critical} total={pig_summary.total} color={COLORS.danger} />
              <StatusBar label="Pregnant"      value={pig_summary.pregnant} total={pig_summary.total} color={COLORS.pink} />
              <StatusBar label="Piglets"       value={pig_summary.piglets}  total={pig_summary.total} color={COLORS.purple} />
            </View>
          </View>

          {/* Stage breakdown bar chart */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Pigs by Growth Stage</Text>
            <BarChart
              data={stage_breakdown}
              labelKey="stage"
              valueKey="count"
              color={COLORS.primary}
              maxValue={Math.max(...stage_breakdown.map(d => d.count), 1)}
            />
          </View>

          {/* Gender split */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Gender Distribution</Text>
            <View style={s.genderSplit}>
              {gender_breakdown.map(g => {
                const pct = pig_summary.total > 0
                  ? Math.round((g.count / pig_summary.total) * 100) : 0;
                const color = g.gender === "Female" ? COLORS.pink : COLORS.blue;
                return (
                  <View key={g.gender} style={s.genderItem}>
                    <Text style={[s.genderPct, { color }]}>{pct}%</Text>
                    <Text style={s.genderLabel}>{g.gender}</Text>
                    <Text style={s.genderCount}>{g.count} pigs</Text>
                    <View style={s.genderBarBg}>
                      <View style={[s.genderBarFill,
                        { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Weight trend */}
          {weight_trend.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Average Weight Trend (kg)</Text>
              <LineChart data={weight_trend} labelKey="month" valueKey="avg_weight"
                color={COLORS.primary} unit="kg" />
            </View>
          )}
          {weight_trend.length === 0 && (
            <EmptyCard icon="⚖️" text="No weight records yet" />
          )}
        </View>
      )}

      {/* ── HEALTH TAB ───────────────────────────────────────────────────── */}
      {tab === "health" && (
        <View style={s.tabContent}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Health Log Summary</Text>
            <View style={s.healthGrid}>
              <HealthMetric icon="✅" label="Normal"   value={health_summary.normal}   color={COLORS.healthy} />
              <HealthMetric icon="⚠️" label="Warnings" value={health_summary.warning}  color={COLORS.warning} />
              <HealthMetric icon="🔴" label="Critical" value={health_summary.critical} color={COLORS.danger}  />
              <HealthMetric icon="📋" label="Total logs" value={health_summary.total_health_logs} color={COLORS.blue} />
            </View>
          </View>

          {/* Health severity bar chart */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Health Severity Distribution</Text>
            <BarChart
              data={[
                { label: "Normal",   count: health_summary.normal },
                { label: "Warning",  count: health_summary.warning },
                { label: "Critical", count: health_summary.critical },
              ]}
              labelKey="label"
              valueKey="count"
              colors={[COLORS.healthy, COLORS.warning, COLORS.danger]}
              maxValue={Math.max(health_summary.normal, health_summary.warning, health_summary.critical, 1)}
            />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Vaccination & Disease</Text>
            <View style={s.vacRow}>
              <VacCard icon="💉" label="Vaccinations done" value={vaccination_summary.completed} color={COLORS.primary} />
              <VacCard icon="⏰" label="Due this week"     value={vaccination_summary.due_soon}  color={COLORS.warning} />
              <VacCard icon="🦠" label="Disease cases"     value={vaccination_summary.disease_cases} color={COLORS.danger} />
            </View>
          </View>

          {/* Recovery rate indicator */}
          {vaccination_summary.disease_cases > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Farm Health Score</Text>
              <View style={s.healthScoreWrap}>
                {(() => {
                  const score = pig_summary.total > 0
                    ? Math.round((pig_summary.healthy / pig_summary.total) * 100) : 100;
                  const color = score >= 80 ? COLORS.healthy : score >= 60 ? COLORS.warning : COLORS.danger;
                  const label = score >= 80 ? "Excellent 🌟" : score >= 60 ? "Good 👍" : "Needs Attention ⚠️";
                  return (
                    <>
                      <Text style={[s.healthScore, { color }]}>{score}%</Text>
                      <Text style={s.healthScoreLabel}>{label}</Text>
                      <View style={s.progressBg}>
                        <View style={[s.progressFill, { width: `${score}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={s.healthScoreSub}>
                        {pig_summary.healthy} of {pig_summary.total} pigs are healthy
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── BREEDING TAB ─────────────────────────────────────────────────── */}
      {tab === "breeding" && (
        <View style={s.tabContent}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Breeding Performance</Text>
            <View style={s.breedingKPIs}>
              <BreedingKPI icon="📝" label="Total records"   value={breeding_summary.total_records} />
              <BreedingKPI icon="🌸" label="Currently pregnant" value={breeding_summary.currently_pregnant} />
              <BreedingKPI icon="🐣" label="Total litters"   value={breeding_summary.total_litters} />
              <BreedingKPI icon="📊" label="Avg litter size" value={breeding_summary.avg_litter_size} />
              <BreedingKPI icon="✅" label="Success rate"    value={`${breeding_summary.success_rate_pct}%`} />
              <BreedingKPI icon="🐷" label="Total alive born" value={breeding_summary.total_alive_born} />
            </View>
          </View>

          {/* Success rate visual */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Breeding Success Rate</Text>
            <View style={s.healthScoreWrap}>
              {(() => {
                const rate  = breeding_summary.success_rate_pct;
                const color = rate >= 80 ? COLORS.healthy : rate >= 60 ? COLORS.warning : COLORS.danger;
                return (
                  <>
                    <Text style={[s.healthScore, { color }]}>{rate}%</Text>
                    <Text style={s.healthScoreLabel}>
                      {rate >= 80 ? "Excellent breeder 🌟" : rate >= 60 ? "Average 👍" : "Needs improvement ⚠️"}
                    </Text>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: `${Math.min(rate, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={s.healthScoreSub}>
                      {breeding_summary.total_litters} successful litters from {breeding_summary.total_records} breeding events
                    </Text>
                  </>
                );
              })()}
            </View>
          </View>

          {/* Avg litter size comparison */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Avg Litter Size vs Benchmark</Text>
            <BarChart
              data={[
                { label: "This farm", count: breeding_summary.avg_litter_size },
                { label: "Good (8+)", count: 8 },
                { label: "Excellent (10+)", count: 10 },
              ]}
              labelKey="label"
              valueKey="count"
              colors={[COLORS.primary, COLORS.blue, COLORS.healthy]}
              maxValue={Math.max(breeding_summary.avg_litter_size, 12)}
            />
          </View>
        </View>
      )}

      {/* ── FEED TAB ─────────────────────────────────────────────────────── */}
      {tab === "feed" && (
        <View style={s.tabContent}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Feed Inventory Summary</Text>
            <View style={s.feedGrid}>
              <FeedMetric icon="📦" label="Total stock"
                value={`${feed_summary.total_stock_kg} kg`} color={COLORS.primary} />
              <FeedMetric icon="📋" label="Feed types"
                value={feed_summary.feed_items} color={COLORS.blue} />
              <FeedMetric icon="⚠️" label="Low stock items"
                value={feed_summary.low_stock_items}
                color={feed_summary.low_stock_items > 0 ? COLORS.danger : COLORS.healthy} />
              <FeedMetric icon="⏳" label="Days remaining"
                value={predictions.feed_days_remaining ? `${predictions.feed_days_remaining}d` : "∞"}
                color={predictions.feed_days_remaining && predictions.feed_days_remaining < 7
                  ? COLORS.danger : COLORS.healthy} />
            </View>
          </View>

          {feed_weekly_usage.length > 0 ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Weekly Feed Usage (kg)</Text>
              <BarChart
                data={feed_weekly_usage}
                labelKey="week"
                valueKey="kg_used"
                color={COLORS.amber}
                maxValue={Math.max(...feed_weekly_usage.map(d => d.kg_used), 1)}
              />
            </View>
          ) : (
            <EmptyCard icon="📦" text="No feed usage logs in the last 30 days" />
          )}

          {/* Feed forecast */}
          {predictions.predicted_monthly_feed_kg > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>Feed Forecast — Next 30 Days</Text>
              <View style={s.forecastCard}>
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={[s.forecastValue, { color: COLORS.amber }]}>
                    {predictions.predicted_monthly_feed_kg} kg
                  </Text>
                  <Text style={s.forecastLabel}>Predicted consumption</Text>
                </View>
                <View style={s.forecastDivider} />
                <View style={{ alignItems: "center", flex: 1 }}>
                  <Text style={[s.forecastValue, {
                    color: feed_summary.total_stock_kg >= predictions.predicted_monthly_feed_kg
                      ? COLORS.healthy : COLORS.danger
                  }]}>
                    {feed_summary.total_stock_kg >= predictions.predicted_monthly_feed_kg
                      ? "✅ Sufficient" : "⚠️ Insufficient"}
                  </Text>
                  <Text style={s.forecastLabel}>Stock status</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

// ── Chart components ──────────────────────────────────────────────────────────

function BarChart({ data, labelKey, valueKey, color, colors, maxValue }) {
  return (
    <View style={c.barWrap}>
      {data.map((item, i) => {
        const val     = item[valueKey] || 0;
        const pct     = maxValue > 0 ? (val / maxValue) : 0;
        const barColor= colors ? colors[i % colors.length] : color;
        return (
          <View key={i} style={c.barGroup}>
            <Text style={c.barValue}>{typeof val === "number" ? val : val}</Text>
            <View style={c.barTrack}>
              <View style={[c.barFill, { height: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={c.barLabel} numberOfLines={2}>{item[labelKey]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LineChart({ data, labelKey, valueKey, color, unit }) {
  if (!data || data.length === 0) return null;
  const max    = Math.max(...data.map(d => d[valueKey]), 1);
  const min    = Math.min(...data.map(d => d[valueKey]), 0);
  const range  = max - min || 1;

  return (
    <View>
      <View style={c.lineWrap}>
        {/* Y-axis guide lines */}
        {[0, 25, 50, 75, 100].map(pct => (
          <View key={pct} style={[c.guideLine, { bottom: `${pct}%` }]} />
        ))}

        {/* Data points */}
        {data.map((d, i) => {
          const pct    = ((d[valueKey] - min) / range) * 100;
          const leftPct= data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
          return (
            <View key={i} style={[c.dot,
              { bottom: `${pct}%`, left: `${leftPct}%`, backgroundColor: color }]}>
              <View style={[c.dotInner, { backgroundColor: COLORS.white }]} />
            </View>
          );
        })}
      </View>

      {/* X-axis labels */}
      <View style={c.lineLabels}>
        {data.map((d, i) => (
          <Text key={i} style={c.lineLabel} numberOfLines={1}>{d[labelKey]}</Text>
        ))}
      </View>

      {/* Legend */}
      <View style={c.lineValues}>
        {data.map((d, i) => (
          <Text key={i} style={[c.lineValue, { color }]}>{d[valueKey]}{unit}</Text>
        ))}
      </View>
    </View>
  );
}

function StatusBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={c.statusBarRow}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={c.statusBarLabel}>{label}</Text>
        <Text style={[c.statusBarPct, { color }]}>{value} ({pct}%)</Text>
      </View>
      <View style={c.statusBarBg}>
        <View style={[c.statusBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function KPI({ icon, value, label, color }) {
  return (
    <View style={[s.kpi, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text style={[s.kpiValue, { color }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function PredCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.predCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[s.predValue, { color }]}>{value}</Text>
      <Text style={s.predLabel}>{label}</Text>
    </View>
  );
}

function HealthMetric({ icon, label, value, color }) {
  return (
    <View style={s.healthMetric}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[s.healthMetricValue, { color }]}>{value}</Text>
      <Text style={s.healthMetricLabel}>{label}</Text>
    </View>
  );
}

function VacCard({ icon, label, value, color }) {
  return (
    <View style={[s.vacCard, { borderLeftColor: color }]}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.vacValue, { color }]}>{value}</Text>
      <Text style={s.vacLabel}>{label}</Text>
    </View>
  );
}

function BreedingKPI({ icon, label, value }) {
  return (
    <View style={s.breedingKPI}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={s.breedingKPIValue}>{value}</Text>
      <Text style={s.breedingKPILabel}>{label}</Text>
    </View>
  );
}

function FeedMetric({ icon, label, value, color }) {
  return (
    <View style={[s.feedMetric, { borderLeftColor: color }]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={[s.feedValue, { color }]}>{value}</Text>
      <Text style={s.feedLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function EmptyCard({ icon, text }) {
  return (
    <View style={[s.card, { alignItems: "center", paddingVertical: 32 }]}>
      <Text style={{ fontSize: 36, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: COLORS.screenBg },
  center:  { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted, marginTop: 12 },

  profileCard:   { backgroundColor: COLORS.primary, padding: 20, paddingTop: 24, flexDirection: "row", gap: 14, alignItems: "flex-start" },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  profileName:   { fontSize: 18, fontWeight: "800", color: COLORS.white },
  profileMeta:   { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 3 },
  statusBadge:   { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText:    { fontSize: 11, fontWeight: "600" },

  kpiRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 14, gap: 8 },
  kpi:    { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, alignItems: "center", ...SHADOW.sm },
  kpiValue:{ fontSize: 20, fontWeight: "800" },
  kpiLabel:{ fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  section:       { marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 10 },

  predictionGrid:{ flexDirection: "row", flexWrap: "wrap", gap: 10 },
  predCard:      { width: "47%", borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm, gap: 4 },
  predValue:     { fontSize: 18, fontWeight: "800" },
  predLabel:     { fontSize: 10, color: COLORS.textMuted },

  tabRow:          { flexDirection: "row", marginHorizontal: 16, marginTop: 16, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 4, ...SHADOW.sm, overflow: "hidden" },
  tabBtn:          { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: RADIUS.lg },
  tabBtnActive:    { backgroundColor: COLORS.primary },
  tabBtnText:      { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  tabBtnTextActive:{ color: COLORS.white, fontWeight: "700" },

  tabContent: { marginHorizontal: 16, marginTop: 14, gap: 12 },
  card:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardTitle:  { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 14 },

  statusBars: { gap: 10 },

  genderSplit: { flexDirection: "row", gap: 16 },
  genderItem:  { flex: 1 },
  genderPct:   { fontSize: 26, fontWeight: "800" },
  genderLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  genderCount: { fontSize: 11, color: COLORS.textMuted, marginBottom: 8 },
  genderBarBg: { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  genderBarFill:{ height: 8, borderRadius: 4 },

  healthGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  healthMetric: { width: "47%", alignItems: "center", padding: 14, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg },
  healthMetricValue:{ fontSize: 22, fontWeight: "800", marginTop: 4 },
  healthMetricLabel:{ fontSize: 11, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  healthScoreWrap: { alignItems: "center", paddingVertical: 8 },
  healthScore:     { fontSize: 48, fontWeight: "800" },
  healthScoreLabel:{ fontSize: 14, fontWeight: "600", color: COLORS.textSecondary, marginTop: 4 },
  progressBg:      { height: 10, width: "100%", backgroundColor: COLORS.borderLight, borderRadius: 5, marginTop: 12, overflow: "hidden" },
  progressFill:    { height: 10, borderRadius: 5 },
  healthScoreSub:  { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },

  vacRow:  { flexDirection: "row", gap: 8 },
  vacCard: { flex: 1, alignItems: "center", padding: 12, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, borderLeftWidth: 3 },
  vacValue:{ fontSize: 22, fontWeight: "800", marginTop: 4 },
  vacLabel:{ fontSize: 9, color: COLORS.textMuted, textAlign: "center", marginTop: 2 },

  breedingKPIs: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  breedingKPI:  { width: "30%", alignItems: "center", padding: 12, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg },
  breedingKPIValue:{ fontSize: 18, fontWeight: "800", color: COLORS.textPrimary, marginTop: 4 },
  breedingKPILabel:{ fontSize: 9, color: COLORS.textMuted, textAlign: "center", marginTop: 2 },

  feedGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  feedMetric:  { width: "47%", padding: 14, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, borderLeftWidth: 3 },
  feedValue:   { fontSize: 20, fontWeight: "800", marginTop: 4 },
  feedLabel:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  forecastCard:{ flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  forecastDivider:{ width: 1, height: 60, backgroundColor: COLORS.border },
  forecastValue:  { fontSize: 18, fontWeight: "800", textAlign: "center" },
  forecastLabel:  { fontSize: 11, color: COLORS.textMuted, marginTop: 4, textAlign: "center" },
});

// Chart styles
const c = StyleSheet.create({
  barWrap:    { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 8, paddingTop: 16 },
  barGroup:   { flex: 1, alignItems: "center", height: "100%" },
  barValue:   { fontSize: 10, color: COLORS.textMuted, fontWeight: "600", marginBottom: 3 },
  barTrack:   { flex: 1, width: "80%", backgroundColor: COLORS.borderLight, borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" },
  barFill:    { width: "100%", borderRadius: 4 },
  barLabel:   { fontSize: 9, color: COLORS.textMuted, marginTop: 5, textAlign: "center" },

  lineWrap:   { height: 120, marginBottom: 8, position: "relative", borderBottomWidth: 1, borderBottomColor: COLORS.border },
  guideLine:  { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: COLORS.borderLight },
  dot:        { position: "absolute", width: 12, height: 12, borderRadius: 6, marginLeft: -6, marginBottom: -6, justifyContent: "center", alignItems: "center" },
  dotInner:   { width: 5, height: 5, borderRadius: 3 },
  lineLabels: { flexDirection: "row", justifyContent: "space-between" },
  lineLabel:  { fontSize: 9, color: COLORS.textMuted, flex: 1, textAlign: "center" },
  lineValues: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  lineValue:  { fontSize: 10, fontWeight: "600", flex: 1, textAlign: "center" },

  statusBarRow:  { marginBottom: 10 },
  statusBarLabel:{ fontSize: 12, color: COLORS.textSecondary },
  statusBarPct:  { fontSize: 12, fontWeight: "600" },
  statusBarBg:   { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  statusBarFill: { height: 8, borderRadius: 4 },
});