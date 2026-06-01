import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, TextInput, ActivityIndicator, Alert, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW, STAGE_COLORS, STATUS_COLORS } from "../theme";

const FILTERS = [
  { key: "All",      label: "All"      },
  { key: "grower",   label: "Growers"  },
  { key: "finisher", label: "Finishers"},
  { key: "breeder",  label: "Sows"     },
  { key: "piglet",   label: "Piglets"  },
  { key: "weaner",   label: "Weaners"  },
];

export default function PigListScreen({ navigation }) {
  const [pigs, setPigs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [activeFilter, setFilter] = useState("All");

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (activeFilter !== "All") params.stage = activeFilter;
      const data = await api.getPigs(params);
      const list = data.results || data;
      console.log("PigListScreen API response count:", list.length);
      setPigs(list);
    } catch (e) {
      console.error("PigListScreen load error:", e);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    console.log("PigListScreen focused — loading pigs...");
    load();
  }, [activeFilter]));

  async function deletePig(pig) {
    Alert.alert(
      "Remove pig",
      `Are you sure you want to remove ${pig.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await api.deletePig(pig.id);
              console.log("Deleted pig:", pig.name);
              load();
            } catch (e) { Alert.alert("Error", e.message); }
          },
        },
      ]
    );
  }

  const filtered = pigs.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.pig_id.toLowerCase().includes(search.toLowerCase())
  );

  console.log("Rendering PigListScreen — pigs:", pigs.length, "filtered:", filtered.length, "loading:", loading);

  return (
    <View style={s.screen}>
      {/* Search bar */}
      <View style={s.searchWrap}>
        <View style={s.searchBar}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search pigs..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Filter pills */}
      <View style={s.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.pill, activeFilter === f.key && s.pillActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.pillText, activeFilter === f.key && s.pillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={{ fontSize: 48 }}>🐷</Text>
              <Text style={s.emptyTitle}>
                {pigs.length === 0 ? "No pigs yet" : "No pigs match your search"}
              </Text>
              <Text style={s.emptySub}>
                {pigs.length === 0
                  ? "Tap the + button below to add your first pig"
                  : "Try a different filter or search term"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PigCard
              pig={item}
              onPress={() => {
                console.log("Navigating to PigDetail for:", item.name);
                navigation.navigate("PigDetail", { pig: item });
              }}
              onDelete={() => deletePig(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate("AddPig")}
        activeOpacity={0.85}
      >
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function PigCard({ pig, onPress, onDelete }) {
  const status = STATUS_COLORS[pig.health_status] || STATUS_COLORS.healthy;
  const stage  = STAGE_COLORS[pig.growth_stage]   || STAGE_COLORS.grower;
  const genderColor = pig.gender === "female" ? COLORS.pink : COLORS.blue;

  return (
    <TouchableOpacity style={s.pigCard} onPress={onPress} activeOpacity={0.85}>
      {/* Avatar */}
      <View style={s.pigAvatar}>
        <Text style={{ fontSize: 28 }}>🐷</Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <View style={s.pigNameRow}>
          <Text style={s.pigName}>{pig.name}</Text>
          <Text style={[s.genderIcon, { color: genderColor }]}>
            {pig.gender === "female" ? "♀" : "♂"}
          </Text>
        </View>
        <Text style={s.pigId}>{pig.pig_id}</Text>
        <View style={s.pigTags}>
          <View style={[s.tag, { backgroundColor: stage.bg }]}>
            <Text style={[s.tagText, { color: stage.text }]}>
              {pig.growth_stage.charAt(0).toUpperCase() + pig.growth_stage.slice(1)}
            </Text>
          </View>
          <Text style={s.pigWeight}>
            {pig.latest_weight ? `• ${pig.latest_weight} kg` : "• No weight"}
          </Text>
        </View>
      </View>

      {/* Status + delete */}
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <View style={[s.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[s.statusDot, { backgroundColor: status.dot }]} />
          <Text style={[s.statusText, { color: status.text }]}>
            {pig.health_status === "under_treatment" ? "Under Obs." :
             pig.health_status.charAt(0).toUpperCase() + pig.health_status.slice(1)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 14, color: COLORS.textMuted }}>🗑</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchWrap: { padding: 16, paddingBottom: 8 },
  searchBar:  { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 10, gap: 8, ...SHADOW.sm },
  searchIcon: { fontSize: 16 },
  searchInput:{ flex: 1, fontSize: 14, color: COLORS.textPrimary },

  filterWrapper: { paddingVertical: 10, backgroundColor: COLORS.screenBg },
  filterContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  pill:          { height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, justifyContent: "center", alignItems: "center" },
  pillActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:      { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600", lineHeight: 20 },
  pillTextActive:{ color: COLORS.white, fontWeight: "700", lineHeight: 20 },

  pigCard:    { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, ...SHADOW.sm },
  pigAvatar:  { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  pigNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  pigName:    { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  genderIcon: { fontSize: 14, fontWeight: "700" },
  pigId:      { fontSize: 11, color: COLORS.textMuted, marginTop: 1, fontFamily: "monospace" },
  pigTags:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  tag:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  tagText:    { fontSize: 11, fontWeight: "600" },
  pigWeight:  { fontSize: 11, color: COLORS.textMuted },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 11, fontWeight: "600" },

  fab:     { position: "absolute", bottom: 24, alignSelf: "center", width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", ...SHADOW.lg },
  fabText: { fontSize: 30, color: COLORS.white, lineHeight: 34 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: "center", paddingHorizontal: 40 },
});