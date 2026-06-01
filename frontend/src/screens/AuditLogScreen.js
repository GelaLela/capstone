import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const BASE_URL = "http://192.168.1.4:8000/api";

const ACTION_CONFIG = {
  create: { icon: "➕", bg: COLORS.healthyBg,   text: COLORS.healthy,  label: "Created" },
  update: { icon: "✏️", bg: COLORS.blueBg,       text: COLORS.blue,     label: "Updated" },
  delete: { icon: "🗑", bg: COLORS.dangerBg,     text: COLORS.danger,   label: "Deleted" },
  login:  { icon: "🔐", bg: COLORS.primaryLight, text: COLORS.primary,  label: "Login"   },
  logout: { icon: "🚪", bg: COLORS.warningBg,    text: COLORS.warning,  label: "Logout"  },
};

const ACTION_FILTERS = [
  { key: "All",    label: "All"     },
  { key: "create", label: "Created" },
  { key: "update", label: "Updated" },
  { key: "delete", label: "Deleted" },
  { key: "login",  label: "Login"   },
  { key: "logout", label: "Logout"  },
];

export default function AuditLogScreen() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(null);
  const [expanded, setExpanded]   = useState(null);
  const [search, setSearch]       = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useFocusEffect(useCallback(() => {
    loadLogs();
  }, []));

  async function loadLogs() {
    setLoading(true);
    try {
      const params = {};
      if (actionFilter !== "All") params.action    = actionFilter;
      if (search.trim())          params.search    = search.trim();
      if (dateFrom.trim())        params.date_from = dateFrom.trim();
      if (dateTo.trim())          params.date_to   = dateTo.trim();

      const data = await api.getAuditLogs(params);
      setLogs(data.results || data);
    } catch (e) {
      Alert.alert("Error", "Could not load audit logs. " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() { loadLogs(); }

  function clearFilters() {
    setSearch(""); setActionFilter("All"); setDateFrom(""); setDateTo("");
    setTimeout(loadLogs, 100);
  }

  /**
   * Export fix: fetch the file in-app with the auth token,
   * save to the device's temp directory, then share via system sheet.
   */
  async function handleExport(type) {
    setExporting(type);
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Export Failed", "You must be signed in to export reports.");
        return;
      }

      const params = new URLSearchParams();
      if (actionFilter !== "All") params.append("action",    actionFilter);
      if (search.trim())          params.append("search",    search.trim());
      if (dateFrom.trim())        params.append("date_from", dateFrom.trim());
      if (dateTo.trim())          params.append("date_to",   dateTo.trim());
      const query = params.toString() ? `?${params.toString()}` : "";

      const endpointMap = {
        pdf:   `/audit-logs/download_pdf/${query}`,
        excel: `/audit-logs/download_excel/${query}`,
        csv:   `/audit-logs/download_csv/${query}`,
      };
      const extMap     = { pdf: "pdf", excel: "xlsx", csv: "csv" };
      const mimeMap    = {
        pdf:   "application/pdf",
        excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        csv:   "text/csv",
      };

      const url      = `${BASE_URL}${endpointMap[type]}`;
      const filename = `piglytics_audit_log.${extMap[type]}`;
      const fileUri  = FileSystem.cacheDirectory + filename;

      // Download with auth token
      const result = await FileSystem.downloadAsync(url, fileUri, {
        headers: { Authorization: `Token ${token}` },
      });

      if (result.status !== 200) {
        Alert.alert("Export Failed", "The server could not generate the report. Please try again.");
        return;
      }

      // Open system share sheet
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Export Saved", `Report saved to: ${fileUri}`);
        return;
      }

      await Sharing.shareAsync(result.uri, {
        mimeType:   mimeMap[type],
        dialogTitle:`Piglytics Audit Log — ${type.toUpperCase()}`,
        UTI:        type === "pdf" ? "com.adobe.pdf"
                  : type === "csv" ? "public.comma-separated-values-text"
                  : "org.openxmlformats.spreadsheetml.sheet",
      });

    } catch (e) {
      console.error("Export error:", e);
      Alert.alert("Export Failed", "Could not generate the report. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📋 Audit Logs</Text>
          <Text style={s.headerSub}>{logs.length} entries loaded</Text>
        </View>
        <TouchableOpacity
          style={s.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={s.filterToggleText}>{showFilters ? "▲ Hide" : "⚙️ Filter"}</Text>
        </TouchableOpacity>
      </View>

      {/* Export buttons */}
      <View style={s.exportRow}>
        <ExportBtn icon="📊" label="Excel"
          color={COLORS.healthy} bg={COLORS.healthyBg}
          loading={exporting === "excel"}
          onPress={() => handleExport("excel")} />
        <ExportBtn icon="📄" label="PDF"
          color={COLORS.danger} bg={COLORS.dangerBg}
          loading={exporting === "pdf"}
          onPress={() => handleExport("pdf")} />
        <ExportBtn icon="📋" label="CSV"
          color={COLORS.blue} bg={COLORS.blueBg}
          loading={exporting === "csv"}
          onPress={() => handleExport("csv")} />
      </View>

      {/* Filter panel */}
      {showFilters && (
        <View style={s.filterPanel}>
          <View style={s.searchBar}>
            <Text style={{ fontSize: 14 }}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search descriptions, users..."
              placeholderTextColor={COLORS.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={applyFilters}
            />
          </View>

          <View style={s.dateRow}>
            <View style={s.dateField}>
              <Text style={s.dateLabel}>From (YYYY-MM-DD)</Text>
              <TextInput style={s.dateInput} placeholder="e.g. 2025-01-01"
                placeholderTextColor={COLORS.textMuted} value={dateFrom}
                onChangeText={setDateFrom} />
            </View>
            <View style={s.dateField}>
              <Text style={s.dateLabel}>To (YYYY-MM-DD)</Text>
              <TextInput style={s.dateInput} placeholder="e.g. 2025-12-31"
                placeholderTextColor={COLORS.textMuted} value={dateTo}
                onChangeText={setDateTo} />
            </View>
          </View>

          <Text style={s.filterSectionLabel}>Filter by action</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {ACTION_FILTERS.map(f => (
              <TouchableOpacity key={f.key}
                style={[s.chip, actionFilter === f.key && s.chipActive]}
                onPress={() => setActionFilter(f.key)}>
                <Text style={[s.chipText, actionFilter === f.key && s.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={s.filterActions}>
            <TouchableOpacity style={s.clearBtn} onPress={clearFilters}>
              <Text style={s.clearBtnText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={applyFilters}>
              <Text style={s.applyBtnText}>Apply filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Log list */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ color: COLORS.textMuted, marginTop: 10 }}>Loading audit logs...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {logs.length === 0 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>📋</Text>
              <Text style={s.emptyTitle}>No audit logs found</Text>
              <Text style={s.emptySub}>
                {search || actionFilter !== "All" || dateFrom || dateTo
                  ? "Try clearing your filters"
                  : "System activity will appear here"}
              </Text>
            </View>
          )}

          {logs.map((log, i) => {
            const cfg   = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
            const isExp = expanded === i;

            return (
              <TouchableOpacity key={i} style={s.logCard}
                onPress={() => setExpanded(isExp ? null : i)}
                activeOpacity={0.85}>
                <View style={s.logCardHeader}>
                  <View style={[s.actionIconWrap, { backgroundColor: cfg.bg }]}>
                    <Text style={{ fontSize: 18 }}>{cfg.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.logTopRow}>
                      <Text style={s.logUser}>{log.full_name || log.username}</Text>
                      <View style={[s.actionBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={[s.actionBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={s.logDesc} numberOfLines={isExp ? undefined : 2}>
                      {log.description}
                    </Text>
                  </View>
                </View>

                <View style={s.logMetaRow}>
                  {log.model_name ? (
                    <View style={s.moduleBadge}>
                      <Text style={s.moduleText}>{log.model_name}</Text>
                    </View>
                  ) : null}
                  <View style={s.roleBadge}>
                    <Text style={s.roleText}>{log.role}</Text>
                  </View>
                  <Text style={s.logTime}>{log.created_at}</Text>
                </View>

                {isExp && (
                  <View style={s.expandedDetails}>
                    <DetailRow label="Username"   value={log.username} />
                    <DetailRow label="Full name"  value={log.full_name || "—"} />
                    <DetailRow label="Role"       value={log.role} />
                    <DetailRow label="Action"     value={log.action_label} />
                    <DetailRow label="Module"     value={log.model_name || "—"} />
                    <DetailRow label="IP Address" value={log.ip_address || "Not recorded"} />
                    <DetailRow label="Timestamp"  value={log.created_at} />
                    <View style={s.descFull}>
                      <Text style={s.descLabel}>Description</Text>
                      <Text style={s.descValue}>{log.description}</Text>
                    </View>
                  </View>
                )}

                <Text style={s.expandHint}>{isExp ? "▲ Collapse" : "▼ Tap for details"}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function ExportBtn({ icon, label, color, bg, loading, onPress }) {
  return (
    <TouchableOpacity
      style={[s.exportBtn, { backgroundColor: bg, borderColor: color }]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator size="small" color={color} />
        : <Text style={{ fontSize: 16 }}>{icon}</Text>}
      <Text style={[s.exportBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DetailRow({ label, value }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.screenBg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },

  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: COLORS.white, ...SHADOW.sm },
  headerTitle:      { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  headerSub:        { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  filterToggle:     { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  filterToggleText: { fontSize: 13, color: COLORS.primary, fontWeight: "700" },

  exportRow:    { flexDirection: "row", gap: 8, padding: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  exportBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: RADIUS.lg, borderWidth: 1 },
  exportBtnText:{ fontSize: 13, fontWeight: "700" },

  filterPanel:        { backgroundColor: COLORS.white, padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBar:          { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.lg, paddingHorizontal: 12, paddingVertical: 4, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  searchInput:        { flex: 1, fontSize: 14, color: COLORS.textPrimary, paddingVertical: 9 },
  dateRow:            { flexDirection: "row", gap: 10 },
  dateField:          { flex: 1 },
  dateLabel:          { fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: "500" },
  dateInput:          { backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 10, fontSize: 13, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  filterSectionLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  chip:               { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.screenBg, borderWidth: 1, borderColor: COLORS.border },
  chipActive:         { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:           { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  chipTextActive:     { color: COLORS.white, fontWeight: "700" },
  filterActions:      { flexDirection: "row", gap: 10 },
  clearBtn:           { flex: 1, padding: 10, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  clearBtnText:       { fontSize: 13, color: COLORS.textSecondary, fontWeight: "600" },
  applyBtn:           { flex: 2, padding: 10, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, alignItems: "center" },
  applyBtnText:       { fontSize: 13, color: COLORS.white, fontWeight: "700" },

  logCard:        { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 14, ...SHADOW.sm },
  logCardHeader:  { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 8 },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  logTopRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  logUser:        { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, flex: 1 },
  actionBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full, marginLeft: 6 },
  actionBadgeText:{ fontSize: 11, fontWeight: "600" },
  logDesc:        { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
  logMetaRow:     { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 },
  moduleBadge:    { backgroundColor: COLORS.screenBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  moduleText:     { fontSize: 10, color: COLORS.textMuted, fontWeight: "600" },
  roleBadge:      { backgroundColor: COLORS.primaryLight, paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  roleText:       { fontSize: 10, color: COLORS.primary, fontWeight: "600" },
  logTime:        { fontSize: 11, color: COLORS.textMuted, marginLeft: "auto" },
  expandHint:     { fontSize: 10, color: COLORS.textMuted, textAlign: "center", marginTop: 4 },

  expandedDetails:{ backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 12, marginTop: 8, gap: 6 },
  detailRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  detailLabel:    { fontSize: 12, color: COLORS.textMuted, fontWeight: "500" },
  detailValue:    { fontSize: 12, color: COLORS.textPrimary, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  descFull:       { marginTop: 4 },
  descLabel:      { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  descValue:      { fontSize: 12, color: COLORS.textPrimary, lineHeight: 18 },

  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: "center" },
});