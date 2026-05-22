import React, { useEffect, useState,useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert,
} from "react-native";
import { api } from "../services/api";

 
const STAGES = ["All", "piglet", "weaner", "grower", "finisher", "breeder"];
const STATUS_COLORS = {
  healthy: { bg: "#EAF3DE", text: "#3B6D11" },
  under_treatment: { bg: "#FAEEDA", text: "#854F0B" },
  critical: { bg: "#FCEBEB", text: "#A32D2D" },
};
 
export default function PigListScreen({ navigation }) {
  const [pigs, setPigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStage, setActiveStage] = useState("All");

  async function deletePig(pig) {
    Alert.alert(
      "Delete pig",
      `Are you sure you want to delete ${pig.name}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deletePig(pig.id);
              Alert.alert("Deleted", `${pig.name} has been removed.`);
              load();
            } catch (e) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  }

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (activeStage !== "All") params.stage = activeStage;
      const data = await api.getPigs(params);
      setPigs(data.results || data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
 
  useFocusEffect(
    useCallback(() => { load(); }, [activeStage])
  );
 
  const filtered = pigs.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.pig_id.toLowerCase().includes(search.toLowerCase())
  );
 
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Search by name or ID..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#B4B2A9"
      />
      <View style={styles.tabRow}>
        {STAGES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, activeStage === s && styles.tabActive]}
            onPress={() => setActiveStage(s)}
          >
            <Text style={[styles.tabText, activeStage === s && styles.tabTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1D9E75" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <PigCard
              pig={item}
              onPress={() => navigation.navigate("PigDetail", { pig: item })}
              onDelete={() => deletePig(item)}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={styles.empty}>No pigs found.</Text>}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate("AddPig")}>
        <Text style={styles.fabText}>+ Add Pig</Text>
      </TouchableOpacity>
    </View>
  );
}
 
function PigCard({ pig, onPress, onDelete }) {
  const statusStyle = STATUS_COLORS[pig.health_status] || STATUS_COLORS.healthy;
  return (
    <View style={styles.card}>
      <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 12 }} onPress={onPress}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{pig.name.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardRow}>
            <Text style={styles.pigName}>{pig.name}</Text>
            <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                {pig.health_status.replace("_", " ")}
              </Text>
            </View>
          </View>
          <Text style={styles.pigSub}>
            {pig.pig_id} · {pig.growth_stage} · {pig.age_in_months} mo
          </Text>
          {pig.latest_weight && (
            <Text style={styles.pigWeight}>{pig.latest_weight} kg</Text>
          )}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
        <Text style={styles.deleteBtnText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  search: {
    margin: 12, backgroundColor: "#fff", borderRadius: 10,
    padding: 12, fontSize: 14, color: "#2C2C2A",
    borderWidth: 0.5, borderColor: "#D3D1C7",
  },
  tabRow: { flexDirection: "row", paddingHorizontal: 12, gap: 6, flexWrap: "wrap", marginBottom: 4 },
  tab: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 0.5, borderColor: "#D3D1C7", backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: "#1D9E75", borderColor: "#1D9E75" },
  tabText: { fontSize: 12, color: "#5F5E5A", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 0.5, borderColor: "#D3D1C7",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FBEAF0", justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#D4537E" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pigName: { fontSize: 15, fontWeight: "600", color: "#2C2C2A" },
  pigSub: { fontSize: 12, color: "#888780", marginTop: 2 },
  pigWeight: { fontSize: 13, fontWeight: "600", color: "#1D9E75", marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  empty: { textAlign: "center", color: "#B4B2A9", marginTop: 40 },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    backgroundColor: "#1D9E75", borderRadius: 30,
    paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  deleteBtn: {
  padding: 10,
  marginLeft: 6,
  backgroundColor: "#FCEBEB",
  borderRadius: 8,
  justifyContent: "center",
  alignItems: "center",
  },
  deleteBtnText: {
    fontSize: 18,
  },
});

