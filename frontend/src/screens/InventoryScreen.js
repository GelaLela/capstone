import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

export default function InventoryScreen() {
  const [feed, setFeed]                   = useState([]);
  const [medicine, setMedicine]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState("feed");
  const [addFeedModal, setAddFeedModal]   = useState(false);
  const [addMedModal, setAddMedModal]     = useState(false);
  const [newFeed, setNewFeed]             = useState({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
  const [newMed, setNewMed]               = useState({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
  const [addingSaving, setAddingSaving]   = useState(false);
  const [restockAmount, setRestockAmount] = useState({});
  const [usageAmount, setUsageAmount]     = useState({});

  async function load() {
    try {
      const [f, m] = await Promise.all([api.getFeed(), api.getMedicine()]);
      setFeed(f.results || f);
      setMedicine(m.results || m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function saveNewFeed() {
    if (!newFeed.stock_kg) { Alert.alert("Required", "Please enter the stock amount."); return; }
    setAddingSaving(true);
    try {
      await api.addFeed({ feed_type: newFeed.feed_type, stock_kg: parseFloat(newFeed.stock_kg), daily_usage_kg: parseFloat(newFeed.daily_usage_kg || "0") });
      Alert.alert("Added!", "Feed stock updated.");
      setAddFeedModal(false);
      setNewFeed({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }

  async function saveNewMedicine() {
    if (!newMed.name || !newMed.quantity) { Alert.alert("Required", "Name and quantity required."); return; }
    setAddingSaving(true);
    try {
      await api.addMedicine({ name: newMed.name, category: newMed.category, quantity: parseInt(newMed.quantity), unit: newMed.unit, low_stock_threshold: parseInt(newMed.low_stock_threshold || "10") });
      Alert.alert("Added!", `${newMed.name} added.`);
      setAddMedModal(false);
      setNewMed({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }

  async function restockFeed(item) {
    const amount = restockAmount[item.id];
    if (!amount || isNaN(parseFloat(amount))) { Alert.alert("Enter amount", "Type the kg to add."); return; }
    try {
      await api.updateFeed(item.id, { stock_kg: parseFloat(item.stock_kg) + parseFloat(amount) });
      Alert.alert("Restocked!", `${amount}kg added.`);
      setRestockAmount(prev => ({ ...prev, [item.id]: "" }));
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  async function logUsage(item) {
    const amount = usageAmount[item.id];
    if (!amount || isNaN(parseFloat(amount))) { Alert.alert("Enter amount", "Type kg used today."); return; }
    try {
      await api.logFeedUsage(item.id, parseFloat(amount));
      Alert.alert("Logged!", `${amount}kg deducted.`);
      setUsageAmount(prev => ({ ...prev, [item.id]: "" }));
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  async function removeFeed(item) {
    Alert.alert("Remove feed", `Remove ${item.feed_type_display}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.deleteFeed(item.id); load(); } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  async function removeMedicine(item) {
    Alert.alert("Remove medicine", `Remove ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try { await api.deleteMedicine(item.id); load(); } catch (e) { Alert.alert("Error", e.message); }
      }},
    ]);
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} size="large" />;

  return (
    <View style={s.screen}>
      {/* Tab switcher */}
      <View style={s.tabWrap}>
        <View style={s.tabPills}>
          <TouchableOpacity style={[s.tabPill, tab === "feed" && s.tabPillActive]} onPress={() => setTab("feed")}>
            <Text style={[s.tabPillText, tab === "feed" && s.tabPillTextActive]}>🌾 Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabPill, tab === "medicine" && s.tabPillActive]} onPress={() => setTab("medicine")}>
            <Text style={[s.tabPillText, tab === "medicine" && s.tabPillTextActive]}>💊 Medicine</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add button */}
        <TouchableOpacity style={s.addBtn}
          onPress={() => tab === "feed" ? setAddFeedModal(true) : setAddMedModal(true)}>
          <Text style={s.addBtnText}>+ Add / Update {tab === "feed" ? "Feed" : "Medicine"}</Text>
        </TouchableOpacity>

        {/* Feed cards */}
        {tab === "feed" && (
          feed.length === 0
            ? <EmptyState icon="🌾" text="No feed stock available" sub="Tap the button above to add feed" />
            : feed.map(item => {
              const stock    = parseFloat(item.stock_kg);
              const isOut    = stock <= 0;
              const isLow    = !isOut && stock <= 25;
              const pct      = item.days_remaining ? Math.min(100, (item.days_remaining / 30) * 100) : 0;
              const barColor = isOut ? COLORS.danger : isLow ? COLORS.warning : COLORS.primary;
              const badgeLabel = isOut ? "No Stock" : isLow ? "Low Stock" : "Good";
              const badgeBg    = isOut ? COLORS.dangerBg : isLow ? COLORS.warningBg : COLORS.healthyBg;
              const badgeColor = isOut ? COLORS.danger : isLow ? COLORS.warning : COLORS.healthy;

              return (
                <View key={item.id} style={[s.invCard, isOut && s.invCardDanger, isLow && !isOut && s.invCardWarn]}>
                  <View style={s.invHeader}>
                    <View style={s.invIconWrap}>
                      <Text style={{ fontSize: 26 }}>🌾</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.invName}>{item.feed_type_display}</Text>
                      <Text style={s.invSub}>Daily usage: {item.daily_usage_kg} kg/day</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <View style={[s.invBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[s.invBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeFeed(item)}>
                        <Text style={{ fontSize: 13, color: COLORS.textMuted }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={s.stockRow}>
                    <Text style={s.stockCurrent}>{item.stock_kg}</Text>
                    <Text style={s.stockSlash}> kg remaining</Text>
                  </View>

                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: pct + "%", backgroundColor: barColor }]} />
                  </View>

                  <View style={s.inputRow}>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Log usage (kg)</Text>
                      <View style={s.inputWrap}>
                        <TextInput style={s.numInput} placeholder="kg"
                          placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad"
                          value={usageAmount[item.id] || ""}
                          onChangeText={v => setUsageAmount(p => ({ ...p, [item.id]: v }))} />
                        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.dangerBg }]}
                          onPress={() => logUsage(item)}>
                          <Text style={[s.inputBtnText, { color: COLORS.danger }]}>Use</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Restock (kg)</Text>
                      <View style={s.inputWrap}>
                        <TextInput style={s.numInput} placeholder="kg"
                          placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad"
                          value={restockAmount[item.id] || ""}
                          onChangeText={v => setRestockAmount(p => ({ ...p, [item.id]: v }))} />
                        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.primaryLight }]}
                          onPress={() => restockFeed(item)}>
                          <Text style={[s.inputBtnText, { color: COLORS.primary }]}>Add</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
        )}

        {/* Medicine cards */}
        {tab === "medicine" && (
          medicine.length === 0
            ? <EmptyState icon="💊" text="No medicine in stock" sub="Tap the button above to add medicine" />
            : medicine.map(item => (
              <MedCard key={item.id} item={item} onRemove={() => removeMedicine(item)}
                onUpdate={async (type, amount) => {
                  if (!amount || isNaN(parseInt(amount))) { Alert.alert("Enter amount", "Type a number first."); return; }
                  try {
                    await api.updateMedicineStock(item.id, type, parseInt(amount));
                    Alert.alert(type === "deduct" ? "Used!" : "Restocked!", `${item.name} updated.`);
                    load();
                  } catch (e) { Alert.alert("Error", e.message); }
                }} />
            ))
        )}
      </ScrollView>

      {/* ── Add Feed Modal ────────────────────────────────────────────────────
          KeyboardAvoidingView inside the modal fixes iOS where the modal
          does not automatically adjust for the keyboard.
          presentationStyle="pageSheet" on iOS means the modal is a sheet —
          behavior="padding" is correct here.
          On Android the modal itself is a new window so the OS handles it. */}
      <Modal visible={addFeedModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add / Update Feed</Text>
              <TouchableOpacity onPress={() => setAddFeedModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.fieldLabel}>Feed type</Text>
              {[
                ["starter",   "Luntian Starter"],
                ["grower",    "Luntian Grower"],
                ["finisher",  "Luntian Finisher"],
                ["lactation", "Sow Lactation Mix"],
              ].map(([val, label]) => (
                <TouchableOpacity key={val}
                  style={[s.feedOption, newFeed.feed_type === val && s.feedOptionActive]}
                  onPress={() => setNewFeed(f => ({ ...f, feed_type: val }))}>
                  <Text style={[s.feedOptionText, newFeed.feed_type === val && { color: COLORS.primary, fontWeight: "700" }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[s.fieldLabel, { marginTop: 16 }]}>Stock to add (kg) *</Text>
              <TextInput style={s.modalInput}
                value={newFeed.stock_kg}
                onChangeText={v => setNewFeed(f => ({ ...f, stock_kg: v }))}
                placeholder="e.g. 50" placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad" returnKeyType="next" />

              <Text style={[s.fieldLabel, { marginTop: 14 }]}>Daily usage (kg)</Text>
              <TextInput style={s.modalInput}
                value={newFeed.daily_usage_kg}
                onChangeText={v => setNewFeed(f => ({ ...f, daily_usage_kg: v }))}
                placeholder="e.g. 5" placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad" returnKeyType="done" />

              <TouchableOpacity style={s.saveBtn} onPress={saveNewFeed} disabled={addingSaving}>
                <Text style={s.saveBtnText}>{addingSaving ? "Saving..." : "Save Feed"}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Medicine Modal ───────────────────────────────────────────────── */}
      <Modal visible={addMedModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Add / Update Medicine</Text>
              <TouchableOpacity onPress={() => setAddMedModal(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ padding: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.fieldLabel}>Name *</Text>
              <TextInput style={s.modalInput}
                value={newMed.name}
                onChangeText={v => setNewMed(f => ({ ...f, name: v }))}
                placeholder="e.g. Vitamin C" placeholderTextColor={COLORS.textMuted}
                returnKeyType="next" />

              <Text style={[s.fieldLabel, { marginTop: 14 }]}>Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  ["antibiotic",     "Antibiotic"],
                  ["antiparasitic",  "Antiparasitic"],
                  ["vitamin",        "Vitamin"],
                  ["vaccine",        "Vaccine"],
                  ["other",          "Other"],
                ].map(([val, label]) => (
                  <TouchableOpacity key={val}
                    style={[s.catChip, newMed.category === val && s.catChipActive]}
                    onPress={() => setNewMed(f => ({ ...f, category: val }))}>
                    <Text style={[s.catChipText, newMed.category === val && { color: COLORS.white }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[s.fieldLabel, { marginTop: 14 }]}>Quantity *</Text>
              <TextInput style={s.modalInput}
                value={newMed.quantity}
                onChangeText={v => setNewMed(f => ({ ...f, quantity: v }))}
                placeholder="e.g. 30" placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad" returnKeyType="next" />

              <Text style={[s.fieldLabel, { marginTop: 14 }]}>Unit</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["doses", "tabs", "vials", "sachets", "bottles", "ml"].map(u => (
                  <TouchableOpacity key={u}
                    style={[s.catChip, newMed.unit === u && s.catChipActive]}
                    onPress={() => setNewMed(f => ({ ...f, unit: u }))}>
                    <Text style={[s.catChipText, newMed.unit === u && { color: COLORS.white }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.saveBtn} onPress={saveNewMedicine} disabled={addingSaving}>
                <Text style={s.saveBtnText}>{addingSaving ? "Saving..." : "Save Medicine"}</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MedCard({ item, onUpdate, onRemove }) {
  const [amount, setAmount] = useState("");
  const isOut      = item.quantity === 0;
  const isLow      = !isOut && item.is_low_stock;
  const badgeLabel = isOut ? "No Stock" : isLow ? "Low Stock" : "Good";
  const badgeBg    = isOut ? COLORS.dangerBg : isLow ? COLORS.warningBg : COLORS.healthyBg;
  const badgeColor = isOut ? COLORS.danger : isLow ? COLORS.warning : COLORS.healthy;

  return (
    <View style={[s.invCard, isOut && s.invCardDanger, isLow && !isOut && s.invCardWarn]}>
      <View style={s.invHeader}>
        <View style={s.invIconWrap}>
          <Text style={{ fontSize: 26 }}>💊</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.invName}>{item.name}</Text>
          <Text style={s.invSub}>{item.category_display}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[s.invBadge, { backgroundColor: badgeBg }]}>
            <Text style={[s.invBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
          <TouchableOpacity onPress={onRemove}>
            <Text style={{ fontSize: 13, color: COLORS.textMuted }}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.medQty}>{item.quantity} <Text style={s.medUnit}>{item.unit}</Text></Text>
      {item.expiry_date && <Text style={s.invSub}>Expires: {item.expiry_date}</Text>}

      <View style={s.inputWrap}>
        <TextInput style={[s.numInput, { flex: 1 }]} placeholder="Amount"
          placeholderTextColor={COLORS.textMuted} keyboardType="number-pad"
          value={amount} onChangeText={setAmount} returnKeyType="done" />
        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.dangerBg }]}
          onPress={() => { onUpdate("deduct", amount); setAmount(""); }}>
          <Text style={[s.inputBtnText, { color: COLORS.danger }]}>Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.primaryLight }]}
          onPress={() => { onUpdate("restock", amount); setAmount(""); }}>
          <Text style={[s.inputBtnText, { color: COLORS.primary }]}>Restock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({ icon, text, sub }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary }}>{text}</Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: COLORS.screenBg },
  tabWrap:  { backgroundColor: COLORS.white, padding: 12, paddingBottom: 8, ...SHADOW.sm },
  tabPills: { flexDirection: "row", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.full, padding: 4 },
  tabPill:  { flex: 1, paddingVertical: 8, borderRadius: RADIUS.full, alignItems: "center" },
  tabPillActive:    { backgroundColor: COLORS.primary },
  tabPillText:      { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabPillTextActive:{ color: COLORS.white },

  addBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: "center" },
  addBtnText:{ color: COLORS.white, fontWeight: "700", fontSize: 14 },

  invCard:       { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  invCardWarn:   { borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  invCardDanger: { borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  invHeader:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  invIconWrap:   { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  invName:       { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  invSub:        { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  invBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  invBadgeText:  { fontSize: 11, fontWeight: "600" },

  stockRow:    { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  stockCurrent:{ fontSize: 26, fontWeight: "800", color: COLORS.textPrimary },
  stockSlash:  { fontSize: 13, color: COLORS.textMuted, marginLeft: 4 },

  progressBg:   { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden", marginBottom: 12 },
  progressFill: { height: 8, borderRadius: 4 },

  inputRow:    { flexDirection: "row", gap: 10 },
  inputGroup:  { flex: 1 },
  inputLabel:  { fontSize: 11, color: COLORS.textMuted, marginBottom: 4, fontWeight: "500" },
  inputWrap:   { flexDirection: "row", gap: 6, marginTop: 10, alignItems: "center" },
  numInput:    { flex: 1, backgroundColor: COLORS.screenBg, borderRadius: RADIUS.md, padding: 9, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  inputBtn:    { paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.md },
  inputBtnText:{ fontSize: 13, fontWeight: "700" },

  medQty:  { fontSize: 24, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 4 },
  medUnit: { fontSize: 14, fontWeight: "400", color: COLORS.textMuted },

  modal:       { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:  { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  modalClose:  { fontSize: 18, color: COLORS.textMuted, padding: 4 },
  modalInput:  { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border, marginBottom: 4 },
  fieldLabel:  { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  feedOption:       { padding: 13, backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  feedOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  feedOptionText:   { fontSize: 14, color: COLORS.textPrimary },
  catChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  catChipActive:{ backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:  { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  saveBtn:      { marginTop: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  saveBtnText:  { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});