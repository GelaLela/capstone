/**
 * frontend/src/screens/InventoryScreen.js
 * All emojis replaced with PNG icons. No tintColor applied.
 * Required field asterisks added to modals.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Alert, TextInput, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const ICONS = {
  feeds:   require("../assets/icons/feeds.png"),
  pill:    require("../assets/icons/pill.png"),
  logout:  require("../assets/icons/logout.png"),  // trash placeholder
  analytics: require("../assets/icons/analytics.png"),
};

function RL({ text }) {
  return (
    <Text style={s.fieldLabel}>
      {text}<Text style={{ color: "#E53935", fontWeight: "800" }}> *</Text>
    </Text>
  );
}

export default function InventoryScreen() {
  const [feed,       setFeed]       = useState([]);
  const [medicine,   setMedicine]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("feed");
  const [addFeedModal, setAddFeedModal] = useState(false);
  const [addMedModal,  setAddMedModal]  = useState(false);
  const [newFeed, setNewFeed] = useState({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
  const [feedErrors, setFeedErrors] = useState({});
  const [newMed,  setNewMed]  = useState({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
  const [medErrors, setMedErrors] = useState({});
  const [addingSaving, setAddingSaving] = useState(false);
  const [restockAmount, setRestockAmount] = useState({});
  const [usageAmount,   setUsageAmount]   = useState({});

  async function load() {
    try {
      const [f, m] = await Promise.all([api.getFeed(), api.getMedicine()]);
      setFeed(f.results || f);
      setMedicine(m.results || m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function validateFeed() {
    const e = {};
    if (!newFeed.stock_kg.trim()) e.stock_kg = "Stock amount is required.";
    else if (isNaN(parseFloat(newFeed.stock_kg)) || parseFloat(newFeed.stock_kg) <= 0)
      e.stock_kg = "Enter a valid amount greater than 0.";
    setFeedErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateMed() {
    const e = {};
    if (!newMed.name.trim())     e.name     = "Medicine name is required.";
    if (!newMed.quantity.trim()) e.quantity = "Quantity is required.";
    else if (isNaN(parseInt(newMed.quantity)) || parseInt(newMed.quantity) <= 0)
      e.quantity = "Enter a valid quantity greater than 0.";
    setMedErrors(e);
    return Object.keys(e).length === 0;
  }

  async function saveNewFeed() {
    if (!validateFeed()) return;
    setAddingSaving(true);
    try {
      await api.addFeed({ feed_type: newFeed.feed_type, stock_kg: parseFloat(newFeed.stock_kg), daily_usage_kg: parseFloat(newFeed.daily_usage_kg || "0") });
      Alert.alert("Added!", "Feed stock updated.");
      setAddFeedModal(false);
      setNewFeed({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
      setFeedErrors({});
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }

  async function saveNewMedicine() {
    if (!validateMed()) return;
    setAddingSaving(true);
    try {
      await api.addMedicine({ name: newMed.name, category: newMed.category, quantity: parseInt(newMed.quantity), unit: newMed.unit, low_stock_threshold: parseInt(newMed.low_stock_threshold || "10") });
      Alert.alert("Added!", `${newMed.name} added.`);
      setAddMedModal(false);
      setNewMed({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
      setMedErrors({});
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }

  async function restockFeed(item) {
    const amount = restockAmount[item.id];
    if (!amount || isNaN(parseFloat(amount))) { Alert.alert("Enter amount", "Type the kg to add."); return; }
    try {
      await api.updateFeed(item.id, { stock_kg: parseFloat(item.stock_kg) + parseFloat(amount) });
      setRestockAmount(prev => ({ ...prev, [item.id]: "" }));
      load();
    } catch (e) { Alert.alert("Error", e.message); }
  }

  async function logUsage(item) {
    const amount = usageAmount[item.id];
    if (!amount || isNaN(parseFloat(amount))) { Alert.alert("Enter amount", "Type kg used today."); return; }
    try {
      await api.logFeedUsage(item.id, parseFloat(amount));
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
      <View style={s.tabWrap}>
        <View style={s.tabPills}>
          <TouchableOpacity style={[s.tabPill, tab === "feed" && s.tabPillActive]} onPress={() => setTab("feed")}>
            <Text style={[s.tabPillText, tab === "feed" && s.tabPillTextActive]}>Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabPill, tab === "medicine" && s.tabPillActive]} onPress={() => setTab("medicine")}>
            <Text style={[s.tabPillText, tab === "medicine" && s.tabPillTextActive]}>Medicine</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={s.addBtn} onPress={() => tab === "feed" ? setAddFeedModal(true) : setAddMedModal(true)}>
          <Text style={s.addBtnText}>+ Add / Update {tab === "feed" ? "Feed" : "Medicine"}</Text>
        </TouchableOpacity>

        {/* Feed cards */}
        {tab === "feed" && (
          feed.length === 0
            ? <EmptyState iconSource={ICONS.feeds} text="No feed stock available" sub="Tap the button above to add feed" />
            : feed.map(item => {
              const stock    = parseFloat(item.stock_kg);
              const isOut    = stock <= 0;
              const isLow    = !isOut && stock <= 25;
              const pct      = item.days_remaining ? Math.min(100, (item.days_remaining / 30) * 100) : 0;
              const barColor = isOut ? COLORS.danger : isLow ? COLORS.warning : COLORS.primary;
              const badgeLabel = isOut ? "No Stock" : isLow ? "Low Stock" : "Good";
              const badgeBg    = isOut ? COLORS.dangerBg : isLow ? COLORS.warningBg : COLORS.healthyBg;
              const badgeColor = isOut ? COLORS.danger   : isLow ? COLORS.warning   : COLORS.healthy;

              return (
                <View key={item.id} style={[s.invCard, isOut && s.invCardDanger, isLow && !isOut && s.invCardWarn]}>
                  <View style={s.invHeader}>
                    <View style={s.invIconWrap}>
                      <Image source={ICONS.feeds} style={{ width: 28, height: 28, resizeMode: "contain" }} />
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
                        <Image source={ICONS.logout} style={{ width: 15, height: 15, resizeMode: "contain", opacity: 0.45 }} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={s.stockRow}>
                    <Text style={s.stockCurrent}>{item.stock_kg}</Text>
                    <Text style={s.stockSlash}> kg</Text>
                  </View>

                  <View style={s.progressBg}>
                    <View style={[s.progressFill, { width: pct + "%", backgroundColor: barColor }]} />
                  </View>

                  <View style={s.inputRow}>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Log usage</Text>
                      <View style={s.inputWrap}>
                        <TextInput style={s.numInput} placeholder="kg" placeholderTextColor={COLORS.textMuted}
                          keyboardType="decimal-pad" value={usageAmount[item.id] || ""}
                          onChangeText={v => setUsageAmount(p => ({ ...p, [item.id]: v }))} />
                        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.dangerBg }]} onPress={() => logUsage(item)}>
                          <Text style={[s.inputBtnText, { color: COLORS.danger }]}>Use</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Restock</Text>
                      <View style={s.inputWrap}>
                        <TextInput style={s.numInput} placeholder="kg" placeholderTextColor={COLORS.textMuted}
                          keyboardType="decimal-pad" value={restockAmount[item.id] || ""}
                          onChangeText={v => setRestockAmount(p => ({ ...p, [item.id]: v }))} />
                        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.primaryLight }]} onPress={() => restockFeed(item)}>
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
            ? <EmptyState iconSource={ICONS.pill} text="No medicine in stock" sub="Tap the button above to add medicine" />
            : medicine.map(item => (
              <MedCard key={item.id} item={item} onRemove={() => removeMedicine(item)}
                onUpdate={async (type, amount) => {
                  if (!amount || isNaN(parseInt(amount))) { Alert.alert("Enter amount", "Type a number first."); return; }
                  try {
                    await api.updateMedicineStock(item.id, type, parseInt(amount));
                    load();
                  } catch (e) { Alert.alert("Error", e.message); }
                }} />
            ))
        )}
      </ScrollView>

      {/* Add Feed Modal */}
      <Modal visible={addFeedModal} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => { setAddFeedModal(false); setFeedErrors({}); }}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add / Update Feed</Text>
            <TouchableOpacity onPress={() => { setAddFeedModal(false); setFeedErrors({}); }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={s.fieldLabel}>Feed type</Text>
            {[["starter","Luntian Starter"],["grower","Luntian Grower"],["finisher","Luntian Finisher"],["lactation","Sow Lactation Mix"]].map(([val, label]) => (
              <TouchableOpacity key={val} style={[s.feedOption, newFeed.feed_type === val && s.feedOptionActive]}
                onPress={() => setNewFeed(f => ({ ...f, feed_type: val }))}>
                <Text style={[s.feedOptionText, newFeed.feed_type === val && { color: COLORS.primary, fontWeight: "700" }]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ marginTop: 16 }}>
              <RL text="Stock to add (kg)" />
              <TextInput
                style={[s.modalInput, feedErrors.stock_kg && s.modalInputError]}
                value={newFeed.stock_kg}
                onChangeText={v => { setNewFeed(f => ({ ...f, stock_kg: v })); if (feedErrors.stock_kg) setFeedErrors(p => ({ ...p, stock_kg: null })); }}
                placeholder="e.g. 50" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
              {feedErrors.stock_kg ? <Text style={s.errorText}>{feedErrors.stock_kg}</Text> : null}
            </View>
            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Daily usage (kg)</Text>
            <TextInput style={s.modalInput} value={newFeed.daily_usage_kg} onChangeText={v => setNewFeed(f => ({ ...f, daily_usage_kg: v }))} placeholder="e.g. 5" placeholderTextColor={COLORS.textMuted} keyboardType="decimal-pad" />
            <TouchableOpacity style={s.saveBtn} onPress={saveNewFeed} disabled={addingSaving}>
              <Text style={s.saveBtnText}>{addingSaving ? "Saving..." : "Save Feed"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Medicine Modal */}
      <Modal visible={addMedModal} animationType="slide" presentationStyle="pageSheet"
          onRequestClose={() => { setAddMedModal(false); setMedErrors({}); }}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Add / Update Medicine</Text>
            <TouchableOpacity onPress={() => { setAddMedModal(false); setMedErrors({}); }}>
              <Text style={s.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <RL text="Name" />
            <TextInput
              style={[s.modalInput, medErrors.name && s.modalInputError]}
              value={newMed.name}
              onChangeText={v => { setNewMed(f => ({ ...f, name: v })); if (medErrors.name) setMedErrors(p => ({ ...p, name: null })); }}
              placeholder="e.g. Vitamin C" placeholderTextColor={COLORS.textMuted} />
            {medErrors.name ? <Text style={s.errorText}>{medErrors.name}</Text> : null}

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[["antibiotic","Antibiotic"],["antiparasitic","Antiparasitic"],["vitamin","Vitamin"],["vaccine","Vaccine"],["other","Other"]].map(([val, label]) => (
                <TouchableOpacity key={val} style={[s.catChip, newMed.category === val && s.catChipActive]}
                  onPress={() => setNewMed(f => ({ ...f, category: val }))}>
                  <Text style={[s.catChipText, newMed.category === val && { color: COLORS.white }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 14 }}>
              <RL text="Quantity" />
              <TextInput
                style={[s.modalInput, medErrors.quantity && s.modalInputError]}
                value={newMed.quantity}
                onChangeText={v => { setNewMed(f => ({ ...f, quantity: v })); if (medErrors.quantity) setMedErrors(p => ({ ...p, quantity: null })); }}
                placeholder="e.g. 30" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
              {medErrors.quantity ? <Text style={s.errorText}>{medErrors.quantity}</Text> : null}
            </View>

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Unit</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["doses","tabs","vials","sachets","bottles","ml"].map(u => (
                <TouchableOpacity key={u} style={[s.catChip, newMed.unit === u && s.catChipActive]}
                  onPress={() => setNewMed(f => ({ ...f, unit: u }))}>
                  <Text style={[s.catChipText, newMed.unit === u && { color: COLORS.white }]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.saveBtn} onPress={saveNewMedicine} disabled={addingSaving}>
              <Text style={s.saveBtnText}>{addingSaving ? "Saving..." : "Save Medicine"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function MedCard({ item, onUpdate, onRemove }) {
  const [amount, setAmount] = useState("");
  const isOut    = item.quantity === 0;
  const isLow    = !isOut && item.is_low_stock;
  const badgeLabel = isOut ? "No Stock" : isLow ? "Low Stock" : "Good";
  const badgeBg    = isOut ? COLORS.dangerBg : isLow ? COLORS.warningBg : COLORS.healthyBg;
  const badgeColor = isOut ? COLORS.danger   : isLow ? COLORS.warning   : COLORS.healthy;

  return (
    <View style={[s.invCard, isOut && s.invCardDanger, isLow && !isOut && s.invCardWarn]}>
      <View style={s.invHeader}>
        <View style={s.invIconWrap}>
          <Image source={require("../assets/icons/pill.png")} style={{ width: 28, height: 28, resizeMode: "contain" }} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.invName}>{item.name}</Text>
          <Text style={s.invSub}>{item.category_display || item.category}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[s.invBadge, { backgroundColor: badgeBg }]}>
            <Text style={[s.invBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
          </View>
          <TouchableOpacity onPress={onRemove}>
            <Image source={require("../assets/icons/logout.png")} style={{ width: 15, height: 15, resizeMode: "contain", opacity: 0.45 }} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.medQty}>{item.quantity} <Text style={s.medUnit}>{item.unit}</Text></Text>
      {item.expiry_date && <Text style={s.invSub}>Expires: {item.expiry_date}</Text>}

      <View style={s.inputWrap}>
        <TextInput style={[s.numInput, { flex: 1 }]} placeholder="Amount" placeholderTextColor={COLORS.textMuted}
          keyboardType="number-pad" value={amount} onChangeText={setAmount} />
        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.dangerBg }]} onPress={() => { onUpdate("deduct", amount); setAmount(""); }}>
          <Text style={[s.inputBtnText, { color: COLORS.danger }]}>Use</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.inputBtn, { backgroundColor: COLORS.primaryLight }]} onPress={() => { onUpdate("restock", amount); setAmount(""); }}>
          <Text style={[s.inputBtnText, { color: COLORS.primary }]}>Restock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function EmptyState({ iconSource, text, sub }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 8 }}>
      <Image source={iconSource} style={{ width: 44, height: 44, resizeMode: "contain", opacity: 0.4 }} />
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary }}>{text}</Text>
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: COLORS.screenBg },
  tabWrap:  { backgroundColor: COLORS.white, padding: 12, paddingBottom: 0, ...SHADOW.sm },
  tabPills: { flexDirection: "row", backgroundColor: COLORS.screenBg, borderRadius: RADIUS.full, padding: 4 },
  tabPill:  { flex: 1, paddingVertical: 8, borderRadius: RADIUS.full, alignItems: "center" },
  tabPillActive:     { backgroundColor: COLORS.primary },
  tabPillText:       { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabPillTextActive: { color: COLORS.white },

  addBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 14, alignItems: "center" },
  addBtnText:{ color: COLORS.white, fontWeight: "700", fontSize: 14 },

  invCard:      { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  invCardWarn:  { borderLeftWidth: 3, borderLeftColor: COLORS.warning },
  invCardDanger:{ borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  invHeader:    { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  invIconWrap:  { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryLight, justifyContent: "center", alignItems: "center" },
  invName:      { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  invSub:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  invBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  invBadgeText: { fontSize: 11, fontWeight: "600" },

  stockRow:    { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  stockCurrent:{ fontSize: 26, fontWeight: "800", color: COLORS.textPrimary },
  stockSlash:  { fontSize: 16, color: COLORS.textMuted, marginLeft: 4 },

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

  modal:          { flex: 1, backgroundColor: COLORS.screenBg },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle:     { fontSize: 17, fontWeight: "700", color: COLORS.textPrimary },
  modalClose:     { fontSize: 18, color: COLORS.textMuted },
  modalInput:     { backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: 13, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
  modalInputError:{ borderColor: "#E53935", borderWidth: 1.5 },
  fieldLabel:     { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary, marginBottom: 8 },
  errorText:      { fontSize: 11, color: "#E53935", marginTop: 4, fontWeight: "500" },
  feedOption:     { padding: 13, backgroundColor: COLORS.white, borderRadius: RADIUS.md, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border },
  feedOptionActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  feedOptionText:   { fontSize: 14, color: COLORS.textPrimary },
  catChip:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catChipText:   { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  saveBtn:     { marginTop: 24, backgroundColor: COLORS.primary, borderRadius: RADIUS.xl, padding: 15, alignItems: "center" },
  saveBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});