/**
 * frontend/src/screens/AdminDashboardScreen.js
 * Updated: tapping a farmer card navigates to FarmerAnalyticsScreen.
 * Stats now accurately reflect only real farmer accounts.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function AdminDashboardScreen({ navigation }) {
  const { logout, username } = useAuth();

  const [stats,      setStats]      = useState(null);
  const [farmers,    setFarmers]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState("");
  const [activeTab,  setActiveTab]  = useState("overview");
  const [userAction, setUserAction] = useState(null);

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    try {
      const [s, f] = await Promise.all([
        api.getAdminStats(),
        api.getAdminFarmers(),
      ]);
      setStats(s);
      setFarmers(f.results || f);
    } catch (e) {
      console.error("Admin dashboard load error:", e);
      Alert.alert("Error", "Could not load admin data. " + e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: () => logout() },
    ]);
  }

  async function handleToggleUser(farmer) {
    const isActive = farmer.is_active;
    Alert.alert(
      isActive ? "Disable User" : "Activate User",
      isActive
        ? `Disable ${farmer.full_name}'s account?`
        : `Activate ${farmer.full_name}'s account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isActive ? "Disable" : "Activate",
          style: isActive ? "destructive" : "default",
          onPress: async () => {
            setUserAction(farmer.id);
            try {
              if (isActive) await api.disableUser(farmer.id);
              else           await api.activateUser(farmer.id);
              load();
            } catch (e) {
              Alert.alert("Error", e.message);
            } finally { setUserAction(null); }
          },
        },
      ]
    );
  }

  async function handleResetPassword(farmer) {
    Alert.alert(
      "Reset Password",
      `Reset password for ${farmer.full_name}?\nNew password: piglytics2025`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset", style: "destructive",
          onPress: async () => {
            try {
              await api.resetUserPassword(farmer.id);
              Alert.alert("Done", `Password for ${farmer.full_name} reset to: piglytics2025`);
            } catch (e) { Alert.alert("Error", e.message); }
          },
        },
      ]
    );
  }

  const filteredFarmers = farmers.filter(f =>
    f.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    f.username?.toLowerCase().includes(search.toLowerCase()) ||
    f.farm_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ color: COLORS.textMuted, marginTop: 12 }}>Loading admin panel...</Text>
    </View>
  );

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
        <View style={s.headerTop}>
          <View>
            <Text style={s.appName}>Piglytics Admin</Text>
            <Text style={s.appSub}>System Management Panel</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.iconBtn}
              onPress={() => navigation.navigate("AuditLog")}>
              <Text style={{ fontSize: 18 }}>📋</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={handleLogout}>
              <Text style={{ fontSize: 18 }}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.adminBadge}>
          <Text style={{ fontSize: 22 }}>🛡️</Text>
          <View>
            <Text style={s.adminBadgeTitle}>Administrator</Text>
            <Text style={s.adminBadgeSub}>@{username} — Full system access</Text>
          </View>
        </View>
      </View>

      {/* System stats */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>📊 System Statistics</Text>
        <Text style={s.sectionNote}>Showing data for farmer accounts only (excludes admin accounts)</Text>
        <View style={s.statsGrid}>
          <StatCard icon="👥" label="Total Farmers" value={stats?.total_users    ?? 0} color={COLORS.blue}    bg={COLORS.blueBg} />
          <StatCard icon="✅" label="Active"        value={stats?.active_users   ?? 0} color={COLORS.healthy} bg={COLORS.healthyBg} />
          <StatCard icon="🚫" label="Disabled"      value={stats?.disabled_users ?? 0} color={COLORS.danger}  bg={COLORS.dangerBg} />
          <StatCard icon="🆕" label="New This Month" value={stats?.new_users_this_month ?? 0} color={COLORS.purple} bg={COLORS.purpleBg} />
          <StatCard icon="🏠" label="Total Farms"   value={stats?.total_farms    ?? 0} color={COLORS.primary} bg={COLORS.primaryLight} />
          <StatCard icon="🐷" label="Total Pigs"    value={stats?.total_pigs     ?? 0} color={COLORS.primary} bg={COLORS.primaryLight} />
          <StatCard icon="🌸" label="Pregnant"      value={stats?.total_pregnant ?? 0} color={COLORS.pink}    bg={COLORS.pinkBg} />
          <StatCard icon="🐣" label="Piglets"       value={stats?.total_piglets  ?? 0} color={COLORS.purple}  bg={COLORS.purpleBg} />
          <StatCard icon="📦" label="Feed Items"    value={stats?.total_feed     ?? 0} color={COLORS.amber}   bg={COLORS.amberBg} />
          <StatCard icon="💊" label="Med Items"     value={stats?.total_medicine ?? 0} color={COLORS.info}    bg={COLORS.infoBg} />
          <StatCard icon="📋" label="Audit Logs"    value={stats?.total_logs     ?? 0} color={COLORS.textSecondary} bg={COLORS.screenBg} />
        </View>
      </View>

      {/* Highlight row */}
      {stats && (
        <View style={s.section}>
          <View style={s.highlightCard}>
            <HighlightStat label="New this month"  value={stats.new_users_this_month ?? 0} />
            <HighlightStat label="Disabled accounts" value={stats.disabled_users ?? 0} />
            <HighlightStat label="Total farms"       value={stats.total_farms ?? 0} />
          </View>
        </View>
      )}

      {/* Audit tools */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>📋 Audit Management</Text>
        <TouchableOpacity style={s.auditCard}
          onPress={() => navigation.navigate("AuditLog")} activeOpacity={0.85}>
          <View style={[s.auditIconWrap, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={{ fontSize: 28 }}>📋</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.auditTitle}>View All Audit Logs</Text>
            <Text style={s.auditSub}>Search, filter by date/action, export PDF / Excel / CSV</Text>
          </View>
          <Text style={{ fontSize: 18, color: COLORS.primary }}>→</Text>
        </TouchableOpacity>
        <View style={s.exportRow}>
          <ExportBtn icon="📊" label="Excel" color={COLORS.healthy} bg={COLORS.healthyBg}
            onPress={() => navigation.navigate("AuditLog")} />
          <ExportBtn icon="📄" label="PDF"   color={COLORS.danger}  bg={COLORS.dangerBg}
            onPress={() => navigation.navigate("AuditLog")} />
          <ExportBtn icon="📋" label="CSV"   color={COLORS.blue}    bg={COLORS.blueBg}
            onPress={() => navigation.navigate("AuditLog")} />
        </View>
      </View>

      {/* Tab switcher */}
      <View style={s.section}>
        <View style={s.tabSwitch}>
          <TouchableOpacity
            style={[s.tabSwitchBtn, activeTab === "overview" && s.tabSwitchActive]}
            onPress={() => setActiveTab("overview")}>
            <Text style={[s.tabSwitchText, activeTab === "overview" && s.tabSwitchTextActive]}>
              🏠 Farm Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tabSwitchBtn, activeTab === "users" && s.tabSwitchActive]}
            onPress={() => setActiveTab("users")}>
            <Text style={[s.tabSwitchText, activeTab === "users" && s.tabSwitchTextActive]}>
              👥 User Management
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={s.section}>
        <View style={s.searchBar}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={s.searchInput}
            placeholder="Search by name, username, or farm..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {filteredFarmers.length > 0 && (
          <Text style={s.resultCount}>{filteredFarmers.length} farmer(s)</Text>
        )}
      </View>

      {/* Farmer cards */}
      <View style={[s.section, { marginBottom: 100 }]}>
        {filteredFarmers.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>👥</Text>
            <Text style={s.emptyTitle}>
              {farmers.length === 0 ? "No farmers registered yet" : "No results found"}
            </Text>
          </View>
        ) : filteredFarmers.map(farmer =>
          activeTab === "overview" ? (
            <FarmerOverviewCard
              key={farmer.id}
              farmer={farmer}
              onPress={() => navigation.navigate("FarmerAnalytics", { farmer })}
            />
          ) : (
            <UserManagementCard
              key={farmer.id}
              farmer={farmer}
              onToggle={() => handleToggleUser(farmer)}
              onReset={() => handleResetPassword(farmer)}
              actioning={userAction === farmer.id}
              onViewAnalytics={() => navigation.navigate("FarmerAnalytics", { farmer })}
            />
          )
        )}
      </View>
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.statCard, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 20, marginBottom: 4 }}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function HighlightStat({ label, value }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={s.highlightValue}>{value}</Text>
      <Text style={s.highlightLabel}>{label}</Text>
    </View>
  );
}

function ExportBtn({ icon, label, color, bg, onPress }) {
  return (
    <TouchableOpacity
      style={[s.exportBtn, { backgroundColor: bg, borderColor: color }]}
      onPress={onPress} activeOpacity={0.8}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={[s.exportBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FarmerOverviewCard({ farmer, onPress }) {
  const isActive = farmer.is_active !== false;
  return (
    <TouchableOpacity
      style={[s.farmerCard, !isActive && { opacity: 0.65 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={s.farmerCardHeader}>
        <View style={s.farmerAvatar}>
          <Text style={{ fontSize: 22 }}>👨‍🌾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.farmerName}>{farmer.full_name}</Text>
            <View style={[s.statusBadge,
              { backgroundColor: isActive ? COLORS.healthyBg : COLORS.dangerBg }]}>
              <Text style={[s.statusBadgeText,
                { color: isActive ? COLORS.healthy : COLORS.danger }]}>
                {isActive ? "Active" : "Disabled"}
              </Text>
            </View>
          </View>
          <Text style={s.farmerMeta}>@{farmer.username}</Text>
          <Text style={s.farmerFarm}>🏠 {farmer.farm_name}</Text>
          <Text style={s.farmerMeta}>📅 Last login: {farmer.last_login}</Text>
        </View>
        <Text style={{ color: COLORS.primary, fontSize: 18 }}>→</Text>
      </View>

      <View style={s.farmerStatsRow}>
        <FarmerStat icon="🐷" label="Pigs"     value={farmer.total_pigs     ?? 0} />
        <FarmerStat icon="🌸" label="Pregnant" value={farmer.pregnant_sows  ?? 0} />
        <FarmerStat icon="🐣" label="Piglets"  value={farmer.total_piglets  ?? 0} />
        <FarmerStat icon="📦" label="Feed"     value={farmer.feed_count     ?? 0} />
        <FarmerStat icon="💊" label="Medicine" value={farmer.medicine_count ?? 0} />
        <FarmerStat icon="🩺" label="HL"       value={farmer.health_logs    ?? 0} />
      </View>

      <Text style={s.tapHint}>Tap to view full analytics →</Text>
    </TouchableOpacity>
  );
}

function FarmerStat({ icon, label, value }) {
  return (
    <View style={s.farmerStat}>
      <Text style={{ fontSize: 14 }}>{icon}</Text>
      <Text style={s.farmerStatValue}>{value}</Text>
      <Text style={s.farmerStatLabel}>{label}</Text>
    </View>
  );
}

function UserManagementCard({ farmer, onToggle, onReset, actioning, onViewAnalytics }) {
  const isActive = farmer.is_active !== false;
  return (
    <View style={s.userCard}>
      <View style={s.userCardHeader}>
        <View style={s.farmerAvatar}>
          <Text style={{ fontSize: 22 }}>👤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.farmerName}>{farmer.full_name}</Text>
          <Text style={s.farmerMeta}>@{farmer.username}</Text>
          {farmer.email ? <Text style={s.farmerMeta}>{farmer.email}</Text> : null}
          <Text style={s.farmerFarm}>🏠 {farmer.farm_name}</Text>
        </View>
        <View style={[s.statusBadge,
          { backgroundColor: isActive ? COLORS.healthyBg : COLORS.dangerBg }]}>
          <Text style={[s.statusBadgeText,
            { color: isActive ? COLORS.healthy : COLORS.danger }]}>
            {isActive ? "Active" : "Disabled"}
          </Text>
        </View>
      </View>

      <View style={s.userMeta}>
        <Text style={s.userMetaText}>🐷 {farmer.total_pigs ?? 0} pigs</Text>
        <Text style={s.userMetaText}>📅 Joined: {farmer.date_joined}</Text>
        <Text style={s.userMetaText}>🕒 Last login: {farmer.last_login}</Text>
      </View>

      <View style={s.userActions}>
        <TouchableOpacity
          style={[s.userActionBtn, {
            backgroundColor: isActive ? COLORS.dangerBg : COLORS.healthyBg,
            borderColor: isActive ? COLORS.danger : COLORS.healthy,
          }]}
          onPress={onToggle} disabled={actioning}>
          {actioning
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={[s.userActionText,
                { color: isActive ? COLORS.danger : COLORS.healthy }]}>
                {isActive ? "🚫 Disable" : "✅ Activate"}
              </Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.userActionBtn, { backgroundColor: COLORS.amberBg, borderColor: COLORS.amber }]}
          onPress={onReset}>
          <Text style={[s.userActionText, { color: COLORS.amber }]}>🔑 Reset PW</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.userActionBtn, { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary }]}
          onPress={onViewAnalytics}>
          <Text style={[s.userActionText, { color: COLORS.primary }]}>📊 Analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg },

  header:         { backgroundColor: COLORS.primary, paddingTop: 52, paddingHorizontal: 20, paddingBottom: 24 },
  headerTop:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  appName:        { fontSize: 22, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  appSub:         { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 },
  iconBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  adminBadge:     { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: RADIUS.xl, padding: 14 },
  adminBadgeTitle:{ fontSize: 15, fontWeight: "700", color: COLORS.white },
  adminBadgeSub:  { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },

  section:      { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6 },
  sectionNote:  { fontSize: 11, color: COLORS.textMuted, marginBottom: 12, fontStyle: "italic" },

  statsGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard:     { width: "30%", borderRadius: RADIUS.lg, padding: 12, ...SHADOW.sm, alignItems: "center" },
  statValue:    { fontSize: 22, fontWeight: "800", marginTop: 2 },
  statLabel:    { fontSize: 9, color: COLORS.textMuted, marginTop: 2, textAlign: "center" },

  highlightCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 16, flexDirection: "row", justifyContent: "space-around", ...SHADOW.sm },
  highlightValue:{ fontSize: 24, fontWeight: "800", color: COLORS.primary, textAlign: "center" },
  highlightLabel:{ fontSize: 11, color: COLORS.textMuted, marginTop: 3, textAlign: "center" },

  auditCard:    { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm, borderLeftWidth: 4, borderLeftColor: COLORS.primary, marginBottom: 10 },
  auditIconWrap:{ width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  auditTitle:   { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  auditSub:     { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  exportRow:    { flexDirection: "row", gap: 8 },
  exportBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: RADIUS.lg, borderWidth: 1 },
  exportBtnText:{ fontSize: 12, fontWeight: "700" },

  tabSwitch:           { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 4, ...SHADOW.sm },
  tabSwitchBtn:        { flex: 1, paddingVertical: 10, borderRadius: RADIUS.lg, alignItems: "center" },
  tabSwitchActive:     { backgroundColor: COLORS.primary },
  tabSwitchText:       { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  tabSwitchTextActive: { color: COLORS.white, fontWeight: "700" },

  searchBar:   { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 4, gap: 8, ...SHADOW.sm },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 10 },
  resultCount: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, marginLeft: 4 },

  farmerCard:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, marginBottom: 10, ...SHADOW.sm },
  farmerCardHeader: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  farmerAvatar:     { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  farmerName:       { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  farmerMeta:       { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  farmerFarm:       { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginTop: 3 },
  farmerStatsRow:   { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10 },
  farmerStat:       { flex: 1, alignItems: "center", paddingVertical: 4 },
  farmerStatValue:  { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginTop: 2 },
  farmerStatLabel:  { fontSize: 9, color: COLORS.textMuted, marginTop: 1 },
  statusBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusBadgeText:  { fontSize: 11, fontWeight: "600" },
  tapHint:          { fontSize: 10, color: COLORS.primary, textAlign: "center", marginTop: 10, fontWeight: "600" },

  userCard:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, marginBottom: 10, ...SHADOW.sm },
  userCardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 10 },
  userMeta:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  userMetaText:   { fontSize: 12, color: COLORS.textMuted },
  userActions:    { flexDirection: "row", gap: 8 },
  userActionBtn:  { flex: 1, paddingVertical: 9, borderRadius: RADIUS.lg, alignItems: "center", borderWidth: 1 },
  userActionText: { fontSize: 11, fontWeight: "700" },

  emptyState: { alignItems: "center", paddingTop: 40, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
});