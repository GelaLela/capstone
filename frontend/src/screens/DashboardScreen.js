import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function DashboardScreen({ navigation }) {
  const { logout } = useAuth();               // ← direct from context, always works
  const [data,       setData]       = useState(null);
  const [weather,    setWeather]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [noFarm,     setNoFarm]     = useState(false);

  async function load() {
    try {
      const storedFarmId = await AsyncStorage.getItem("farmId");
      if (!storedFarmId) { setNoFarm(true); return; }

      const id = parseInt(storedFarmId);
      const [dash, wx] = await Promise.all([
        api.getDashboard(id),
        api.getWeather(id),
      ]);
      setData(dash);
      setWeather(wx);
      setNoFarm(false);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function handleLogout() {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout", style: "destructive",
          onPress: () => logout(), // context clears token → RootNavigator shows Login
        },
      ]
    );
  }

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  const HeaderBar = () => (
    <View style={s.headerTop}>
      <View>
        <Text style={s.appName}>Piglytics</Text>
        <Text style={s.appTagline}>Smart Farming, Happy Herd</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity style={s.iconBtn}
          onPress={() => navigation.navigate("Notifications")}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={handleLogout}>
          <Text style={{ fontSize: 18 }}>🚪</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (noFarm || !data) {
    return (
      <View style={s.screen}>
        <View style={s.header}><HeaderBar /></View>
        <View style={s.welcomeWrap}>
          <Text style={{ fontSize: 64, textAlign: "center" }}>🐷</Text>
          <Text style={s.welcomeTitle}>Welcome to Piglytics!</Text>
          <Text style={s.welcomeSub}>
            Your farm dashboard is ready. Start by adding your first pig to begin monitoring.
          </Text>
          <TouchableOpacity style={s.welcomeBtn}
            onPress={() => navigation.navigate("Pigs", { screen: "AddPig" })}>
            <Text style={s.welcomeBtnText}>+ Add your first pig</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.welcomeBtn, { backgroundColor: COLORS.primaryLight, marginTop: 10 }]}
            onPress={() => navigation.navigate("Inventory", { screen: "InventoryMain" })}>
            <Text style={[s.welcomeBtnText, { color: COLORS.primary }]}>+ Add feed stock</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.screen}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.primary} />
      }
    >
      {/* Header */}
      <View style={s.header}>
        <HeaderBar />
        <View style={s.greetingCard}>
          <View>
            <Text style={s.greetingTitle}>{greeting},{"\n"}Farmer! 🌿</Text>
            <Text style={s.greetingSub}>Here's what's happening{"\n"}on your farm today.</Text>
          </View>
          <Text style={{ fontSize: 64 }}>🐷</Text>
        </View>
      </View>

      {/* Metric cards */}
      <View style={s.metricsGrid}>
        <MetricCard icon="🐷" label="Total Pigs"    value={data?.total_pigs ?? 0}
          sub="Active on farm" color={COLORS.primary} bg={COLORS.primaryLight} />
        <MetricCard icon="📦" label="Low Stocks"
          value={(data?.low_feed_items || 0) + (data?.low_medicine_items || 0)}
          sub="Items need restock" color={COLORS.warning} bg={COLORS.warningBg} />
        <MetricCard icon="💉" label="Vaccination Due" value={data?.vaccinations_due ?? 0}
          sub="This week" color={COLORS.purple} bg={COLORS.purpleBg} />
        <MetricCard icon="❤️" label="Health Alerts"
          value={(data?.under_treatment || 0) + (data?.critical || 0)}
          sub="Need attention" color={COLORS.danger} bg={COLORS.dangerBg} />
      </View>

      {/* Weather alert */}
      {weather && (weather.alert_count || 0) > 0 && (
        <View style={s.weatherAlert}>
          <Text style={{ fontSize: 22 }}>🌧️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.weatherTitle}>{weather.alerts?.[0]?.title || "Weather Alert"}</Text>
            <Text style={s.weatherMsg}>{weather.alerts?.[0]?.message || ""}</Text>
          </View>
          {weather.temperature_c != null && (
            <Text style={s.weatherTemp}>{weather.temperature_c}°C</Text>
          )}
        </View>
      )}

      {/* Farm overview */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Farm Overview</Text>
          <Text style={s.sectionSub}>This Week</Text>
        </View>
        <View style={s.overviewCard}>
          {[
            { label: "Total",    value: data?.total_pigs ?? 0,    color: COLORS.primary },
            { label: "Pregnant", value: data?.pregnant_sows ?? 0, color: COLORS.pink    },
            { label: "Healthy",  value: data?.healthy ?? 0,       color: COLORS.healthy },
            { label: "Alerts",   value: (data?.under_treatment || 0) + (data?.critical || 0), color: COLORS.danger },
          ].map((item, i) => (
            <View key={i} style={s.overviewItem}>
              <Text style={[s.overviewVal, { color: item.color }]}>{item.value}</Text>
              <Text style={s.overviewLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsRow}>
          <ActionCard icon="🐷" label="Add Pig"   color={COLORS.primary}
            onPress={() => navigation.navigate("Pigs", { screen: "AddPig" })} />
          <ActionCard icon="⚖️" label="Log Weight" color={COLORS.blue}
            onPress={() => navigation.navigate("Pigs", { screen: "PigList" })} />
          <ActionCard icon="📦" label="Inventory"  color={COLORS.amber}
            onPress={() => navigation.navigate("Inventory", { screen: "InventoryMain" })} />
          <ActionCard icon="🔔" label="Alerts"     color={COLORS.danger}
            onPress={() => navigation.navigate("Notifications")} />
        </View>
      </View>

      {/* Recent activity */}
      <View style={[s.section, { marginBottom: 100 }]}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Notifications")}>
            <Text style={s.viewAll}>View all →</Text>
          </TouchableOpacity>
        </View>

        {(data?.upcoming_farrowing || 0) > 0 && (
          <ActivityRow icon="🌸" iconBg={COLORS.pinkBg}
            title="Farrowing soon"
            sub={`${data.upcoming_farrowing} sow(s) due within 7 days`}
            time="Today"
            onPress={() => navigation.navigate("Breeding", { screen: "BreedingMain" })} />
        )}
        {(data?.vaccinations_due || 0) > 0 && (
          <ActivityRow icon="💉" iconBg={COLORS.purpleBg}
            title="Vaccination due"
            sub={`${data.vaccinations_due} pig(s) need vaccination`}
            time="This week"
            onPress={() => navigation.navigate("Pigs", { screen: "PigList" })} />
        )}
        {((data?.low_feed_items || 0) + (data?.low_medicine_items || 0)) > 0 && (
          <ActivityRow icon="📦" iconBg={COLORS.amberBg}
            title="Low stock alert"
            sub={`${(data?.low_feed_items || 0) + (data?.low_medicine_items || 0)} item(s) running low`}
            time="Now"
            onPress={() => navigation.navigate("Inventory", { screen: "InventoryMain" })} />
        )}
        {!(data?.upcoming_farrowing) && !(data?.vaccinations_due) &&
          !((data?.low_feed_items || 0) + (data?.low_medicine_items || 0)) && (
          <View style={s.allGood}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
            <Text style={s.allGoodText}>Everything looks good on the farm!</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function MetricCard({ icon, label, value, sub, color, bg }) {
  return (
    <View style={[s.metricCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 22, marginBottom: 6 }}>{icon}</Text>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricSub}>{sub}</Text>
    </View>
  );
}

function ActionCard({ icon, label, color, onPress }) {
  return (
    <TouchableOpacity style={s.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.actionIcon, { backgroundColor: color + "18" }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityRow({ icon, iconBg, title, sub, time, onPress }) {
  return (
    <TouchableOpacity style={s.activityRow} onPress={onPress} activeOpacity={0.8}>
      <View style={[s.activityIcon, { backgroundColor: iconBg }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.activityTitle}>{title}</Text>
        <Text style={s.activitySub}>{sub}</Text>
      </View>
      <Text style={s.activityTime}>{time}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg },

  header:      { backgroundColor: COLORS.primary, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  appName:     { fontSize: 22, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  appTagline:  { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  iconBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  greetingCard:{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.xl, padding: 18 },
  greetingTitle:{ fontSize: 22, fontWeight: "800", color: COLORS.white, lineHeight: 28 },
  greetingSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 18 },

  welcomeWrap:  { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  welcomeTitle: { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary, marginTop: 16, marginBottom: 10, textAlign: "center" },
  welcomeSub:   { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  welcomeBtn:   { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: "center", width: "100%" },
  welcomeBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 20, gap: 12 },
  metricCard:  { width: "47%", borderRadius: RADIUS.lg, padding: 14, ...SHADOW.sm },
  metricValue: { fontSize: 26, fontWeight: "800" },
  metricLabel: { fontSize: 12, fontWeight: "600", color: COLORS.textPrimary, marginTop: 2 },
  metricSub:   { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },

  weatherAlert: { marginHorizontal: 16, marginTop: 12, backgroundColor: COLORS.blueBg, borderRadius: RADIUS.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderLeftWidth: 3, borderLeftColor: COLORS.blue },
  weatherTitle: { fontSize: 13, fontWeight: "700", color: COLORS.blue },
  weatherMsg:   { fontSize: 11, color: "#1E40AF", marginTop: 2 },
  weatherTemp:  { fontSize: 18, fontWeight: "700", color: COLORS.blue },

  section:       { marginHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  sectionSub:    { fontSize: 12, color: COLORS.textMuted },
  viewAll:       { fontSize: 12, color: COLORS.primary, fontWeight: "600" },

  overviewCard:  { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, flexDirection: "row", justifyContent: "space-around", ...SHADOW.sm },
  overviewItem:  { alignItems: "center" },
  overviewVal:   { fontSize: 22, fontWeight: "800" },
  overviewLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },

  actionsRow:   { flexDirection: "row", gap: 10 },
  actionCard:   { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 14, alignItems: "center", ...SHADOW.sm },
  actionIcon:   { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  actionLabel:  { fontSize: 11, fontWeight: "600", color: COLORS.textPrimary, textAlign: "center" },

  activityRow:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, marginBottom: 8, ...SHADOW.sm },
  activityIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  activityTitle:{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  activitySub:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  activityTime: { fontSize: 11, color: COLORS.textMuted },

  allGood:     { backgroundColor: COLORS.healthyBg, borderRadius: RADIUS.lg, padding: 20, alignItems: "center" },
  allGoodText: { fontSize: 13, color: "#2E7D32", fontWeight: "600", textAlign: "center" },
});