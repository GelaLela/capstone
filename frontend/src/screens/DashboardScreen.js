/**
 * frontend/src/screens/DashboardScreen.js
 *
 * Fixes applied:
 *  - Logout button restored (was missing from previous version)
 *  - Notification bell shows red badge when unread notifications exist
 *  - All tintColor removed from Icon calls — PNGs are already colored
 *  - Active states use opacity/background, not color transforms
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

// PNGs are pre-required — no tintColor applied anywhere
const ICONS = {
  pig:       require("../assets/icons/pig.png"),
  bell:      require("../assets/icons/bell.png"),
  logout:    require("../assets/icons/logout.png"),
  pregnant:  require("../assets/icons/pregnant.png"),
  feeds:     require("../assets/icons/feeds.png"),
  vaccine:   require("../assets/icons/vaccine.png"),
  analytics: require("../assets/icons/analytics.png"),
  breeding:  require("../assets/icons/breeding.png"),
  forecast:  require("../assets/icons/forecast.png"),
  farrowed:  require("../assets/icons/forrowed.png"),
  inventory: require("../assets/icons/inventory.png"),
  home:      require("../assets/icons/home.png"),
};

export default function DashboardScreen({ navigation }) {
  const { farmId, username, logout } = useAuth();
  const [dash,       setDash]       = useState(null);
  const [weather,    setWeather]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    if (!farmId) return;
    try {
      // Load dashboard and notifications together.
      // Weather is loaded SEPARATELY so a weather timeout (5–15s on PythonAnywhere)
      // never blocks the dashboard from rendering.
      const [d, notifs] = await Promise.all([
        api.getDashboard(farmId),
        api.getNotifications(),
      ]);
      setDash(d);
      const notifList = notifs?.results || notifs || [];
      setUnreadCount(notifList.filter(n => !n.is_read).length);
    } catch (e) {
      console.error("Dashboard load:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    // Weather loads independently — failure shows "unavailable" card,
    // never freezes the dashboard.
    try {
      const wx = await api.getWeather(farmId);
      setWeather(wx);
    } catch (e) {
      console.error("Weather load:", e.message);
      setWeather({ temperature_c: null, error: "Weather unavailable" });
    }
  }

  useFocusEffect(useCallback(() => { load(); }, [farmId]));

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout() },
    ]);
  }

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const healthScore = dash?.farm_health_score ?? 100;
  const healthColor = healthScore >= 80 ? COLORS.healthy
                    : healthScore >= 60 ? COLORS.warning
                    : COLORS.danger;
  const healthGrade = healthScore >= 80 ? "Excellent"
                    : healthScore >= 60 ? "Good"
                    : healthScore >= 40 ? "Fair" : "Poor";

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.appName}>Piglytics</Text>
            <Text style={s.appTagline}>Smart Farming, Happy Herd</Text>
          </View>

          <View style={s.headerActions}>
            {/* Bell with unread badge */}
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => navigation.navigate("Notifications")}
            >
              <Image source={ICONS.bell} style={s.headerBtnIcon} />
              {unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Logout button */}
            <TouchableOpacity style={s.headerBtn} onPress={handleLogout}>
              <Image source={ICONS.logout} style={s.headerBtnIcon} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting card */}
        <View style={s.greetingCard}>
          <View>
            <Text style={s.greetingTitle}>{greeting},{"\n"}{username || "Farmer"}!</Text>
            <Text style={s.greetingSubtitle}>
              Here's what's happening{"\n"}on your farm today.
            </Text>
          </View>
          <Image source={ICONS.pig} style={s.greetingPig} />
        </View>
      </View>

      {/* ── SECTION 1: STATUS ────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Farm Status</Text>

        {/* Health score card */}
        <View style={[s.healthScoreCard, { borderLeftColor: healthColor }]}>
          <View>
            <Text style={s.healthScoreLabel}>Farm Health Score</Text>
            <Text style={[s.healthScoreValue, { color: healthColor }]}>{healthScore}%</Text>
            <Text style={[s.healthGrade, { color: healthColor }]}>{healthGrade}</Text>
          </View>
          <View style={s.healthScoreRight}>
            <View style={s.progressBg}>
              <View style={[s.progressFill, {
                width: `${Math.min(healthScore, 100)}%`,
                backgroundColor: healthColor,
              }]} />
            </View>
            <Text style={s.healthScoreSub}>
              {dash?.healthy ?? 0} healthy of {dash?.total_pigs ?? 0} pigs
            </Text>
          </View>
        </View>

        {/* KPI grid — icons displayed at natural color, no tint */}
        <View style={s.kpiGrid}>
          <KpiCard
            icon={ICONS.pig}
            label="Total Pigs"
            value={dash?.total_pigs ?? 0}
            valueColor={COLORS.primary}
            bg={COLORS.primaryLight}
          />
          <KpiCard
            icon={ICONS.pregnant}
            label="Pregnant"
            value={dash?.pregnant_sows ?? 0}
            valueColor={COLORS.blue}
            bg={COLORS.blueBg}
          />
          <KpiCard
            icon={ICONS.feeds}
            label="Low Feed"
            value={dash?.low_feed_items ?? 0}
            valueColor={dash?.low_feed_items > 0 ? COLORS.danger : COLORS.healthy}
            bg={dash?.low_feed_items > 0 ? COLORS.dangerBg : COLORS.healthyBg}
          />
          <KpiCard
            icon={ICONS.vaccine}
            label="Vax Due"
            value={dash?.vaccinations_due ?? 0}
            valueColor={COLORS.purple}
            bg={COLORS.purpleBg}
          />
        </View>
      </View>

      {/* ── SECTION 2: WEATHER & PIG COMFORT ──────────────────────────────── */}
      {/* Always renders — shows loading state when weather hasn't loaded yet */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Weather & Environment</Text>
        {weather ? (
          weather.temperature_c != null ? (
            <WeatherComfortCard weather={weather} location={dash?.farm_location || "Concepcion, Piangbakuran"} />
          ) : (
            <View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 20, alignItems: "center", ...SHADOW.sm }}>
              <Text style={{ fontSize: 13, color: COLORS.textMuted }}>Weather data unavailable — check internet connection</Text>
            </View>
          )
        ) : (
          <View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 20, alignItems: "center", ...SHADOW.sm }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>Loading weather...</Text>
          </View>
        )}
      </View>

      {/* ── SECTION 2: ANALYTICS ─────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Analytics</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Analytics")}>
            <Text style={s.viewAllLink}>View all</Text>
          </TouchableOpacity>
        </View>

        <View style={s.analyticsRow}>
          <AnalyticsCard
            icon={ICONS.analytics}
            label="Avg Daily Gain"
            value={dash?.analytics?.avg_adg ? `${dash.analytics.avg_adg} kg/d` : "—"}
            target="Target: 0.65 kg/d"
            borderColor={COLORS.primary}
          />
          <AnalyticsCard
            icon={ICONS.breeding}
            label="Avg Litter Size"
            value={dash?.analytics?.avg_litter_size || "—"}
            target={`Litters this month: ${dash?.analytics?.litters_this_month ?? 0}`}
            borderColor={COLORS.pink}
          />
          <AnalyticsCard
            icon={ICONS.feeds}
            label="Feed This Week"
            value={dash?.analytics?.feed_this_week_kg ? `${dash.analytics.feed_this_week_kg} kg` : "—"}
            target={
              dash?.analytics?.critical_feed_days != null
                ? `Lowest: ${dash.analytics.critical_feed_days}d left`
                : "Stock OK"
            }
            borderColor={COLORS.amber}
          />
        </View>
      </View>

      {/* ── SECTION 3: FORECAST ──────────────────────────────────────────── */}
      <View style={s.section}>
        <View style={s.sectionHeaderRow}>
          <Text style={s.sectionTitle}>Forecast</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Forecast")}>
            <Text style={s.viewAllLink}>View all</Text>
          </TouchableOpacity>
        </View>

        {dash?.forecast?.next_farrowing_sow && (
          <ForecastRow
            icon={ICONS.farrowed}
            title={`${dash.forecast.next_farrowing_sow} — Farrowing expected`}
            sub={`${dash.forecast.next_farrowing_date}`}
            onPress={() => navigation.navigate("Breeding")}
          />
        )}

        {dash?.analytics?.critical_feed_days != null && dash.analytics.critical_feed_days < 7 && (
          <ForecastRow
            icon={ICONS.feeds}
            title="Feed shortage approaching"
            sub={`~${dash.analytics.critical_feed_days} days remaining`}
            onPress={() => navigation.navigate("Inventory")}
            urgent
          />
        )}

        {dash?.forecast?.next_vaccination_pig && (
          <ForecastRow
            icon={ICONS.vaccine}
            title={`${dash.forecast.next_vaccination_pig} — Vaccination due`}
            sub={`${dash.forecast.next_vaccination_name} on ${dash.forecast.next_vaccination_date}`}
            onPress={() => navigation.navigate("Pigs")}
          />
        )}

        {!dash?.forecast?.next_farrowing_sow && !dash?.forecast?.next_vaccination_pig && (
          <View style={s.allGood}>
            <Image source={ICONS.analytics} style={{ width: 24, height: 24, resizeMode: "contain" }} />
            <Text style={s.allGoodText}>No upcoming events — all good!</Text>
          </View>
        )}
      </View>

      {/* ── QUICK ACTIONS ─────────────────────────────────────────────────── */}
      <View style={[s.section, { marginBottom: 100 }]}>
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          <ActionCard
            icon={ICONS.pig}
            label="Add Pig"
            bg={COLORS.primaryLight}
            onPress={() => navigation.navigate("Pigs", { screen: "AddPig" })}
          />
          <ActionCard
            icon={ICONS.analytics}
            label="Log Weight"
            bg={COLORS.blueBg}
            onPress={() => navigation.navigate("Pigs", { screen: "PigList" })}
          />
          <ActionCard
            icon={ICONS.inventory}
            label="Inventory"
            bg={COLORS.amberBg}
            onPress={() => navigation.navigate("Inventory")}
          />
          <ActionCard
            icon={ICONS.analytics}
            label="Analytics"
            bg={COLORS.purpleBg}
            onPress={() => navigation.navigate("Analytics")}
          />
        </View>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, valueColor, bg }) {
  return (
    <View style={[s.kpiCard, { backgroundColor: bg }]}>
      {/* Icon at natural size and color — no tint */}
      <Image source={icon} style={{ width: 22, height: 22, resizeMode: "contain", marginBottom: 6 }} />
      <Text style={[s.kpiValue, { color: valueColor }]}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

function AnalyticsCard({ icon, label, value, target, borderColor }) {
  return (
    <View style={[s.analyticsCard, { borderTopColor: borderColor }]}>
      <Image source={icon} style={{ width: 18, height: 18, resizeMode: "contain", marginBottom: 6 }} />
      <Text style={s.analyticsValue}>{value}</Text>
      <Text style={s.analyticsLabel}>{label}</Text>
      <Text style={s.analyticsTarget}>{target}</Text>
    </View>
  );
}

function ActionCard({ icon, label, bg, onPress }) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.actionIconWrap, { backgroundColor: bg }]}>
        <Image source={icon} style={{ width: 22, height: 22, resizeMode: "contain" }} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ForecastRow({ icon, title, sub, onPress, urgent }) {
  return (
    <TouchableOpacity
      style={[s.forecastRow, urgent && { borderLeftWidth: 3, borderLeftColor: COLORS.danger }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[s.forecastIconWrap, { backgroundColor: urgent ? COLORS.dangerBg : COLORS.primaryLight }]}>
        <Image source={icon} style={{ width: 18, height: 18, resizeMode: "contain" }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.forecastTitle}>{title}</Text>
        <Text style={s.forecastSub}>{sub}</Text>
      </View>
      <Image source={require("../assets/icons/forecast.png")} style={{ width: 14, height: 14, resizeMode: "contain", opacity: 0.4 }} />
    </TouchableOpacity>
  );
}

// ── WeatherComfortCard ────────────────────────────────────────────────────────
// Displays actual Open-Meteo weather data.
// Compares temperature against scientifically accepted pig comfort zones.
// Per-stage breakdown shows °C and °F, comfort zone range, and recommendations.

const STATUS_COLORS = {
  normal:      COLORS.healthy,
  cold_stress: COLORS.blue,
  heat_stress: COLORS.danger,
};
const STATUS_BG = {
  normal:      COLORS.healthyBg,
  cold_stress: COLORS.blueBg,
  heat_stress: COLORS.dangerBg,
};
const STATUS_LABELS = {
  normal:      "Normal",
  cold_stress: "Cold Stress Risk",
  heat_stress: "Heat Stress Risk",
};
const RISK_LEVEL_LABEL = {
  normal:      "Low Risk",
  cold_stress: "Cold Risk",
  heat_stress: "Heat Risk",
};
// COMFORT_LABELS and COMFORT_LABEL (both spellings) used in stage_risks.map
const COMFORT_LABELS = STATUS_LABELS;
const COMFORT_LABEL  = STATUS_LABELS;

function WeatherComfortCard({ weather, location }) {
  const [expanded, setExpanded] = useState(false);

  const temp      = weather.temperature_c;
  const humidity  = weather.humidity_percent;
  const wind      = weather.wind_speed_kph;
  const precip    = weather.precipitation_mm;
  const condition = weather.condition     || "Partly Cloudy";
  const comfort   = weather.pig_comfort;

  const status    = comfort?.overall_status || "normal";
  const ringColor = STATUS_COLORS[status]   || COLORS.blue;
  const chipBg    = STATUS_BG[status]        || COLORS.blueBg;
  const effTemp   = comfort?.effective_temp;
  const showEff   = effTemp != null && effTemp > temp;

  return (
    <View style={wc.outerCard}>
      {/* ── TOP BLOCK: Current weather — always visible ───────────────── */}
      <View style={[wc.weatherTopBlock, { borderBottomColor: COLORS.border }]}>

        {/* Left: big temperature */}
        <View style={wc.tempBlock}>
          <Text style={[wc.bigTemp, { color: ringColor }]}>{temp}°C</Text>
          <Text style={wc.conditionLabel}>{condition}</Text>
          {location ? <Text style={wc.locationLabel}>{location}</Text> : null}
        </View>

        {/* Right: humidity + wind + precip */}
        <View style={wc.weatherMetaBlock}>
          <WeatherMetaRow icon={ICONS.forecast} label="Humidity"  value={`${humidity}%`} />
          {wind  != null && <WeatherMetaRow icon={ICONS.forecast} label="Wind"      value={`${wind} km/h`} />}
          {precip > 0    && <WeatherMetaRow icon={ICONS.forecast} label="Rain"      value={`${precip} mm`} />}
          {showEff && (
            <WeatherMetaRow icon={ICONS.bell} label="Feels like" value={`${effTemp}°C`}
              note="humidity-adjusted" noteColor={COLORS.warning} />
          )}
        </View>
      </View>

      {/* ── PIG COMFORT STATUS — always visible ──────────────────────── */}
      <View style={wc.comfortSection}>
        {/* Pig Comfort Status row */}
        <View style={wc.comfortRow}>
          <View style={wc.comfortRowLeft}>
            <Image source={ICONS.pig} style={{ width: 16, height: 16, resizeMode: "contain" }} />
            <Text style={wc.comfortRowLabel}>Pig Comfort Status</Text>
          </View>
          <View style={[wc.statusChip, { backgroundColor: chipBg }]}>
            <Text style={[wc.statusChipText, { color: ringColor }]}>
              {STATUS_LABELS[status] || "Comfortable"}
            </Text>
          </View>
        </View>

        {/* Environmental Risk Level row */}
        <View style={wc.comfortRow}>
          <View style={wc.comfortRowLeft}>
            <Image source={ICONS.analytics} style={{ width: 16, height: 16, resizeMode: "contain" }} />
            <Text style={wc.comfortRowLabel}>Environmental Risk</Text>
          </View>
          <View style={[wc.riskChip, { backgroundColor: chipBg, borderColor: ringColor }]}>
            <View style={[wc.riskDot, { backgroundColor: ringColor }]} />
            <Text style={[wc.riskChipText, { color: ringColor }]}>
              {RISK_LEVEL_LABEL[status] || "Normal"}
            </Text>
          </View>
        </View>

        {/* Humidity amplification note (when relevant) */}
        {comfort?.humidity_note && (
          <View style={wc.humidityNote}>
            <Text style={wc.humidityText}>{comfort.humidity_note}</Text>
          </View>
        )}

        {/* Pig Impact Summary — always visible */}
        <View style={[wc.impactBox, { borderLeftColor: ringColor, backgroundColor: chipBg }]}>
          <Text style={wc.impactLabel}>Pig Impact</Text>
          <Text style={[wc.impactText, { color: ringColor }]}>
            {comfort?.pig_comfort_summary
              || (weather.alert_count > 0 ? weather.alerts[0].message : "Conditions are within acceptable range for your pigs.")}
          </Text>
        </View>

        {/* Expandable per-stage breakdown */}
        {comfort?.stage_risks?.length > 0 && (
          <>
            <TouchableOpacity style={wc.expandBtn} onPress={() => setExpanded(!expanded)}>
              <Text style={wc.expandBtnText}>
                {expanded
                  ? "Hide per-stage breakdown"
                  : `Show per-stage breakdown (${comfort.stage_risks.length} stages)`}
              </Text>
            </TouchableOpacity>

            {expanded && comfort.stage_risks.map((sr, i) => {
              const srColor = STATUS_COLORS[sr.status]  || COLORS.textMuted;
              const srBg    = STATUS_BG[sr.status]     || COLORS.screenBg;
              return (
                <View key={i} style={[wc.stageRow, { borderLeftColor: srColor }]}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={wc.stageName}>{sr.label}</Text>
                      <View style={[wc.stageChip, { backgroundColor: srBg }]}>
                        <Text style={[wc.stageChipText, { color: srColor }]}>
                          {STATUS_LABELS[sr.status] || "Comfortable"}
                        </Text>
                      </View>
                      {sr.pig_count != null && (
                        <Text style={wc.stageCount}>{sr.pig_count} pigs</Text>
                      )}
                    </View>
                    <Text style={wc.stageTnz}>
                      Comfort zone: {sr.tnz_low}–{sr.tnz_high}°C
                    </Text>
                    {sr.status !== "comfortable" && (
                      <Text style={[wc.stageRec, { color: srColor }]}>
                        {sr.recommendation}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Fallback: show all generic alerts when no pig_comfort data */}
        {!comfort && weather.alert_count > 0 && weather.alerts.map((a, i) => (
          <View key={i} style={[wc.stageRow, { borderLeftColor: COLORS.warning }]}>
            <View style={{ flex: 1 }}>
              <Text style={[wc.stageName, { color: COLORS.warning }]}>{a.title}</Text>
              <Text style={wc.stageRec}>{a.message}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeatherMetaRow({ icon, label, value, note, noteColor }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 }}>
      <Image source={icon} style={{ width: 12, height: 12, resizeMode: "contain", opacity: 0.6 }} />
      <Text style={wc.metaLabel}>{label}:</Text>
      <Text style={wc.metaValue}>{value}</Text>
      {note && <Text style={[wc.metaNote, noteColor && { color: noteColor }]}>{note}</Text>}
    </View>
  );
}

const wc = StyleSheet.create({
  outerCard:      { marginHorizontal: 16, marginTop: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, overflow: "hidden", ...SHADOW.sm },

  // Top weather block
  weatherTopBlock:{ flexDirection: "row", padding: 16, borderBottomWidth: 1, gap: 12 },
  tempBlock:      { flex: 1, justifyContent: "center" },
  bigTemp:        { fontSize: 42, fontWeight: "800", lineHeight: 46 },
  conditionLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600", marginTop: 2 },
  locationLabel:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  weatherMetaBlock:{ flex: 1, justifyContent: "center" },
  metaLabel:      { fontSize: 11, color: COLORS.textMuted, fontWeight: "500" },
  metaValue:      { fontSize: 12, color: COLORS.textPrimary, fontWeight: "700" },
  metaNote:       { fontSize: 10, color: COLORS.warning, fontStyle: "italic" },

  // Comfort section
  comfortSection: { padding: 14, gap: 8 },
  comfortRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  comfortRowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  comfortRowLabel:{ fontSize: 13, color: COLORS.textPrimary, fontWeight: "600" },
  statusChip:     { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  statusChipText: { fontSize: 12, fontWeight: "700" },
  riskChip:       { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  riskDot:        { width: 8, height: 8, borderRadius: 4 },
  riskChipText:   { fontSize: 12, fontWeight: "700" },

  humidityNote:   { backgroundColor: COLORS.warningBg, borderRadius: RADIUS.md, padding: 8 },
  humidityText:   { fontSize: 11, color: COLORS.warning, lineHeight: 16 },

  impactBox:      { borderLeftWidth: 3, borderRadius: RADIUS.md, padding: 10 },
  impactLabel:    { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  impactText:     { fontSize: 12, lineHeight: 18, fontWeight: "500" },

  expandBtn:      { paddingVertical: 8, alignItems: "center" },
  expandBtnText:  { fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  stageRow:       { borderLeftWidth: 2, paddingLeft: 10, paddingVertical: 8 },
  stageName:      { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  stageChip:      { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  stageChipText:  { fontSize: 10, fontWeight: "700" },
  stageCount:     { fontSize: 10, color: COLORS.textMuted },
  stageTnz:       { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  stageRec:       { fontSize: 11, lineHeight: 16, marginTop: 4, fontStyle: "italic", color: COLORS.textSecondary },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: COLORS.screenBg },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
  header:       { backgroundColor: COLORS.primary, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  appName:      { fontSize: 22, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  appTagline:   { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  headerActions:{ flexDirection: "row", gap: 8 },
  headerBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerBtnIcon:{ width: 20, height: 20, resizeMode: "contain" },

  // Notification badge
  badge:     { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, justifyContent: "center", alignItems: "center", paddingHorizontal: 3 },
  badgeText: { fontSize: 9, color: COLORS.white, fontWeight: "800" },

  greetingCard:     { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.xl, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greetingTitle:    { fontSize: 22, fontWeight: "800", color: COLORS.white, lineHeight: 28 },
  greetingSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 18 },
  greetingPig:      { width: 72, height: 72, resizeMode: "contain", opacity: 0.5 },

  // Section
  section:          { marginHorizontal: 16, marginTop: 20 },
  sectionTitle:     { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  viewAllLink:      { fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  // Health score
  healthScoreCard:  { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, borderLeftWidth: 4, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 16, ...SHADOW.sm },
  healthScoreLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  healthScoreValue: { fontSize: 32, fontWeight: "800" },
  healthGrade:      { fontSize: 12, fontWeight: "700" },
  healthScoreRight: { flex: 1 },
  progressBg:       { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden", marginBottom: 6 },
  progressFill:     { height: 8, borderRadius: 4 },
  healthScoreSub:   { fontSize: 11, color: COLORS.textMuted },

  // KPI
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { width: "47%", borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  kpiValue:{ fontSize: 26, fontWeight: "800", marginTop: 2 },
  kpiLabel:{ fontSize: 11, color: COLORS.textPrimary, fontWeight: "600", marginTop: 2 },

  // Weather
  // weather styles moved to WeatherComfortCard (wc StyleSheet)

  // Analytics
  analyticsRow:   { flexDirection: "row", gap: 10 },
  analyticsCard:  { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, borderTopWidth: 3, alignItems: "center", ...SHADOW.sm },
  analyticsValue: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center" },
  analyticsLabel: { fontSize: 10, color: COLORS.textPrimary, fontWeight: "600", marginTop: 2, textAlign: "center" },
  analyticsTarget:{ fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  // Forecast
  forecastRow:     { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, ...SHADOW.sm },
  forecastIconWrap:{ width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  forecastTitle:   { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  forecastSub:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  allGood:     { backgroundColor: COLORS.healthyBg, borderRadius: RADIUS.lg, padding: 20, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  allGoodText: { fontSize: 13, color: COLORS.healthy, fontWeight: "600" },

  // Actions
  actionsGrid:    { flexDirection: "row", gap: 10 },
  actionCard:     { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, alignItems: "center", ...SHADOW.sm },
  actionIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionLabel:    { fontSize: 10, fontWeight: "600", color: COLORS.textPrimary, textAlign: "center" },
});