import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from "react-native";
import { api } from "../services/api";
 
const TYPE_STYLE = {
  health:      { icon: "🩺", bg: "#FCEBEB", border: "#E24B4A", text: "#A32D2D" },
  breeding:    { icon: "🐷", bg: "#E6F1FB", border: "#378ADD", text: "#185FA5" },
  inventory:   { icon: "📦", bg: "#FAEEDA", border: "#EF9F27", text: "#854F0B" },
  weather:     { icon: "🌤️", bg: "#EAF3DE", border: "#97C459", text: "#3B6D11" },
  vaccination: { icon: "💉", bg: "#FBEAF0", border: "#D4537E", text: "#993556" },
};
 
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
 
export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
 
  async function load() {
    try {
      const data = await api.getNotifications();
      setNotifications(data.results || data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
 
  useFocusEffect(
    useCallback(() => { load(); }, [])
  );
 
  async function markRead(id) {
    await api.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }
 
  async function markAllRead() {
    await api.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }
 
  const unread = notifications.filter((n) => !n.is_read).length;
 
  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;
 
  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.unreadCount}>{unread} unread</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const style = TYPE_STYLE[item.notification_type] || TYPE_STYLE.health;
          return (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread, { borderLeftColor: style.border }]}
              onPress={() => !item.is_read && markRead(item.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardRow}>
                <Text style={styles.icon}>{style.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {!item.is_read && <View style={styles.dot} />}
                  </View>
                  <Text style={styles.cardMsg}>{item.message}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.typeBadge, { backgroundColor: style.bg }]}>
                      <Text style={[styles.typeBadgeText, { color: style.text }]}>
                        {item.notification_type.replace("_", " ")}
                      </Text>
                    </View>
                    {item.sent_via_sms && <Text style={styles.smsBadge}>SMS sent</Text>}
                    <Text style={styles.time}>{formatTime(item.created_at)}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  unreadCount: { fontSize: 13, fontWeight: "600", color: "#2C2C2A" },
  markAll: { fontSize: 13, color: "#1D9E75", fontWeight: "600" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: "#D3D1C7", borderLeftWidth: 4 },
  cardUnread: { backgroundColor: "#FAFAF8" },
  cardRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { fontSize: 22, marginTop: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#2C2C2A", flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1D9E75" },
  cardMsg: { fontSize: 13, color: "#5F5E5A", lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  typeBadgeText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  smsBadge: { fontSize: 11, color: "#639922", fontWeight: "600" },
  time: { fontSize: 11, color: "#B4B2A9", marginLeft: "auto" },
  emptyWrap: { alignItems: "center", marginTop: 80 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyText: { color: "#B4B2A9", fontSize: 14 },
});
