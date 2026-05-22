import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from "react-native";
import { api } from "../services/api";

const FARM_ID = 1;

export default function DashboardScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const [dash, wx] = await Promise.all([
        api.getDashboard(FARM_ID),
        api.getWeather(FARM_ID),
      ]);
      setData(dash);
      setWeather(wx);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#1D9E75" /></View>
  );

  return (
    <ScrollView style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <View style={styles.header}>
        <Text style={styles.farmName}>{data?.farm_name || "My Farm"}</Text>
        <Text style={styles.subtitle}>Piglytics Dashboard</Text>
      </View>
      {weather && weather.alert_count > 0 && (
        <View style={styles.weatherBanner}>
          <Text style={styles.weatherTitle}>⚠ Weather Alert</Text>
          <Text style={styles.weatherMsg}>{weather.alerts[0].message}</Text>
          <Text style={styles.weatherSub}>{weather.temperature_c}°C · {weather.humidity_percent}% humidity</Text>
        </View>
      )}
      <View style={styles.grid}>
        <MetricCard label="Total Pigs" value={data?.total_pigs} color="#1D9E75" />
        <MetricCard label="Healthy" value={data?.healthy} color="#639922" />
        <MetricCard label="Pregnant Sows" value={data?.pregnant_sows} color="#185FA5" />
        <MetricCard label="Low Stock" value={(data?.low_feed_items || 0) + (data?.low_medicine_items || 0)} color="#BA7517" />
      </View>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionRow}>
        <ActionButton label="Add Pig" icon="🐷" onPress={() => navigation.navigate("Pigs", { screen: "AddPig" })} />
        <ActionButton label="Log Weight" icon="⚖️" onPress={() => navigation.navigate("Pigs", { screen: "PigList" })} />
        <ActionButton label="Inventory" icon="📦" onPress={() => navigation.navigate("Inventory", { screen: "InventoryMain" })} />
        <ActionButton label="Alerts" icon="🔔" onPress={() => navigation.navigate("Home", { screen: "Notifications" })} />
      </View>
      {data?.upcoming_farrowing > 0 && (
        <AlertCard title={`${data.upcoming_farrowing} sow(s) farrowing soon`}
          message="Check breeding screen." type="warning"
          onPress={() => navigation.navigate("Breeding", { screen: "BreedingMain" })} />
      )}
      {data?.vaccinations_due > 0 && (
        <AlertCard title={`${data.vaccinations_due} vaccination(s) due`}
          message="Visit health records to schedule." type="info"
          onPress={() => navigation.navigate("Pigs", { screen: "PigList" })} />
      )}
    </ScrollView>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color }]}>{value ?? "—"}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}
function ActionButton({ label, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}
function AlertCard({ title, message, type, onPress }) {
  const bg = type === "warning" ? "#FAEEDA" : "#E6F1FB";
  const border = type === "warning" ? "#EF9F27" : "#378ADD";
  const textColor = type === "warning" ? "#854F0B" : "#185FA5";
  return (
    <TouchableOpacity style={[styles.alertCard, { backgroundColor: bg, borderLeftColor: border }]} onPress={onPress}>
      <Text style={[styles.alertTitle, { color: textColor }]}>{title}</Text>
      <Text style={styles.alertMsg}>{message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { backgroundColor: "#1D9E75", padding: 20, paddingTop: 50 },
  farmName: { fontSize: 22, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "#9FE1CB", marginTop: 2 },
  weatherBanner: { margin: 16, padding: 14, backgroundColor: "#FAEEDA", borderRadius: 10, borderLeftWidth: 4, borderLeftColor: "#EF9F27" },
  weatherTitle: { fontSize: 13, fontWeight: "700", color: "#854F0B" },
  weatherMsg: { fontSize: 13, color: "#633806", marginTop: 4 },
  weatherSub: { fontSize: 12, color: "#854F0B", marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingTop: 16, gap: 10 },
  metricCard: { width: "47%", backgroundColor: "#fff", borderRadius: 10, padding: 14, elevation: 2 },
  metricValue: { fontSize: 28, fontWeight: "700" },
  metricLabel: { fontSize: 12, color: "#888780", marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#2C2C2A", marginLeft: 16, marginTop: 20, marginBottom: 10 },
  actionRow: { flexDirection: "row", paddingHorizontal: 12, gap: 10 },
  actionBtn: { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 12, alignItems: "center", elevation: 2 },
  actionIcon: { fontSize: 22 },
  actionLabel: { fontSize: 11, color: "#5F5E5A", marginTop: 4, fontWeight: "500" },
  alertCard: { margin: 16, marginTop: 8, padding: 14, borderRadius: 10, borderLeftWidth: 4 },
  alertTitle: { fontSize: 14, fontWeight: "700" },
  alertMsg: { fontSize: 13, color: "#5F5E5A", marginTop: 2 },
});