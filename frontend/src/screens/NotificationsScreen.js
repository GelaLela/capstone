import React, { useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const FILTERS = ["All", "Health", "Breeding", "Inventory", "Weather"];

const TYPE_CONFIG = {
  health:      { icon: "❤️",  bg: COLORS.dangerBg,  border: COLORS.danger,  text: COLORS.danger,  label: "Health"    },
  breeding:    { icon: "🌸",  bg: "#F3E8FF",         border: "#9333EA",      text: "#9333EA",       label: "Breeding"  },
  inventory:   { icon: "📦",  bg: COLORS.warningBg,  border: COLORS.warning, text: COLORS.warning,  label: "Inventory" },
  weather:     { icon: "🌤️", bg: COLORS.blueBg,     border: COLORS.blue,    text: COLORS.blue,     label: "Weather"   },
  vaccination: { icon: "💉",  bg: "#FDF2F8",         border: COLORS.pink,    text: COLORS.pink,     label: "Vaccine"   },
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)  return "Just now";
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeFilter, setFilter] = useState("All");

  async function load() {
    try {
      const data = await api.getNotifications();
      setNotifications(data.results || data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function markRead(id) {
    await api.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await api.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const unread = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    if (activeFilter === "All") return true;
    return n.notification_type === activeFilter.toLowerCase() ||
           (activeFilter === "Vaccine" && n.notification_type === "vaccination");
  });

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} size="large" />;

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Alerts</Text>
          {unread > 0 && <Text style={s.headerSub}>{unread} unread notifications</Text>}
        </View>
        {unread > 0 && (
          <TouchableOpacity style={s.markAllBtn} onPress={markAllRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
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
              key={f}
              style={[s.pill, activeFilter === f && s.pillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.pillText, activeFilter === f && s.pillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Text style={{ fontSize: 48 }}>🔔</Text>
            <Text style={s.emptyTitle}>No notifications</Text>
            <Text style={s.emptySub}>You're all caught up!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const cfg = TYPE_CONFIG[item.notification_type] || TYPE_CONFIG.health;
          return (
            <TouchableOpacity
              style={[s.card, !item.is_read && { borderLeftWidth: 3, borderLeftColor: cfg.border }]}
              onPress={() => !item.is_read && markRead(item.id)}
              activeOpacity={0.85}
            >
              <View style={[s.iconWrap, { backgroundColor: cfg.bg }]}>
                <Text style={{ fontSize: 20 }}>{cfg.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.cardTop}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                  {!item.is_read && <View style={[s.unreadDot, { backgroundColor: cfg.border }]} />}
                </View>
                <Text style={s.cardMsg} numberOfLines={2}>{item.message}</Text>
                <View style={s.cardMeta}>
                  <View style={[s.typeBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.typeText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  {item.sent_via_sms && (
                    <View style={[s.typeBadge, { backgroundColor: COLORS.healthyBg }]}>
                      <Text style={[s.typeText, { color: COLORS.healthy }]}>SMS sent</Text>
                    </View>
                  )}
                  <Text style={s.timeText}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },

  header:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingTop: 20, backgroundColor: COLORS.white, ...SHADOW.sm },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  headerSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  markAllBtn:  { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full },
  markAllText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" },

  filterWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.screenBg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  pillActive:    { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText:      { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  pillTextActive:{ color: COLORS.white, fontWeight: "700" },

  card:     { flexDirection: "row", gap: 12, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, ...SHADOW.sm },
  iconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  cardTop:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle:{ fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, flex: 1 },
  unreadDot:{ width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  cardMsg:  { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 8 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  typeBadge:{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  typeText: { fontSize: 10, fontWeight: "600" },
  timeText: { fontSize: 11, color: COLORS.textMuted, marginLeft: "auto" },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:   { fontSize: 13, color: COLORS.textMuted },
});