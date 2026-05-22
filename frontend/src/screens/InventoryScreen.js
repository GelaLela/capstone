import React, { useEffect, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View, Text, ScrollView, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { api } from "../services/api";
 
export default function InventoryScreen() {
  const [feed, setFeed] = useState([]);
  const [medicine, setMedicine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("feed");
  const [addFeedModal, setAddFeedModal]   = useState(false);
  const [addMedModal, setAddMedModal]     = useState(false);
  const [newFeed, setNewFeed] = useState({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
  const [newMed,  setNewMed]  = useState({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
  const [addingSaving, setAddingSaving]   = useState(false);
  const [restockAmount, setRestockAmount] = useState({});
 
  async function load() {
    try {
      const [f, m] = await Promise.all([api.getFeed(), api.getMedicine()]);
      setFeed(f.results || f);
      setMedicine(m.results || m);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
 
  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  async function saveNewFeed() {
    if (!newFeed.stock_kg) {
      Alert.alert("Required", "Please enter the stock amount.");
      return;
    }
    setAddingSaving(true);
    try {
      await api.addFeed({
        feed_type:       newFeed.feed_type,
        stock_kg:        parseFloat(newFeed.stock_kg),
        daily_usage_kg:  parseFloat(newFeed.daily_usage_kg || "0"),
      });
      Alert.alert("Added!", "New feed added to inventory.");
      setAddFeedModal(false);
      setNewFeed({ feed_type: "starter", stock_kg: "", daily_usage_kg: "" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }

  async function saveNewMedicine() {
    if (!newMed.name || !newMed.quantity) {
      Alert.alert("Required", "Please fill in name and quantity.");
      return;
    }
    setAddingSaving(true);
    try {
      await api.addMedicine({
        name:                newMed.name,
        category:            newMed.category,
        quantity:            parseInt(newMed.quantity),
        unit:                newMed.unit,
        low_stock_threshold: parseInt(newMed.low_stock_threshold || "10"),
      });
      Alert.alert("Added!", `${newMed.name} added to inventory.`);
      setAddMedModal(false);
      setNewMed({ name: "", category: "antibiotic", quantity: "", unit: "doses", low_stock_threshold: "10" });
      load();
    } catch (e) { Alert.alert("Error", e.message); }
    finally { setAddingSaving(false); }
  }
  async function restockFeed(feedItem) {
    const amount = restockAmount[feedItem.id];
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert("Enter amount", "Please type the kg to add.");
      return;
    }
    try {
      await api.updateFeed(feedItem.id, {
        stock_kg: parseFloat(feedItem.stock_kg) + parseFloat(amount),
      });
      Alert.alert("Restocked!", `${amount}kg added to ${feedItem.feed_type_display}.`);
      setRestockAmount(prev => ({ ...prev, [feedItem.id]: "" }));
      load();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  }
const [usageAmount, setUsageAmount] = useState({});

async function logUsage(feedItem) {
  const amount = usageAmount[feedItem.id];
  if (!amount || isNaN(parseFloat(amount))) {
    Alert.alert("Enter amount", "Please type the kg used in the input box first.");
    return;
  }
  try {
    await api.logFeedUsage(feedItem.id, parseFloat(amount));
    Alert.alert("Logged!", `${amount}kg deducted from ${feedItem.feed_type_display}.`);
    setUsageAmount(prev => ({ ...prev, [feedItem.id]: "" }));
    load();
  } catch (e) { Alert.alert("Error", e.message); }
}
 
  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color="#1D9E75" />;
 
  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "feed" && styles.tabActive]} onPress={() => setTab("feed")}>
          <Text style={[styles.tabText, tab === "feed" && styles.tabTextActive]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "medicine" && styles.tabActive]} onPress={() => setTab("medicine")}>
          <Text style={[styles.tabText, tab === "medicine" && styles.tabTextActive]}>Medicine & Vitamins</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={{ margin: 10, marginTop: 0, backgroundColor: "#1D9E75", borderRadius: 8, padding: 10, alignItems: "center" }}
        onPress={() => tab === "feed" ? setAddFeedModal(true) : setAddMedModal(true)}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
          + Add {tab === "feed" ? "feed" : "medicine / vitamin"}
        </Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {tab === "feed" && feed.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            usageAmount={usageAmount}
            setUsageAmount={setUsageAmount}
            restockAmount={restockAmount}
            setRestockAmount={setRestockAmount}
            onLogUsage={() => logUsage(item)}
            onRestock={() => restockFeed(item)}
          />
        ))}
        {tab === "medicine" && medicine.map((item) => (
          <MedCard
            key={item.id}
            item={item}
            onUpdate={async (actionType, amount) => {
              if (!amount || isNaN(parseInt(amount))) {
                Alert.alert("Enter amount", "Please type a number first.");
                return;
              }
              try {
                await api.updateMedicineStock(item.id, actionType, parseInt(amount));
                Alert.alert(
                  actionType === "deduct" ? "Used!" : "Restocked!",
                  `${item.name} stock updated.`
                );
                load();
              } catch (e) {
                Alert.alert("Error", e.message);
              }
            }}
          />
        ))}
      </ScrollView>

      {/* Add Feed Modal */}
      <Modal visible={addFeedModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#F8F7F2" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 20, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7", alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "700" }}>Add new feed</Text>
            <TouchableOpacity onPress={() => setAddFeedModal(false)}>
              <Text style={{ color: "#888780" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Feed type</Text>
            {[["starter","Luntian Starter"],["grower","Luntian Grower"],["finisher","Luntian Finisher"],["lactation","Sow Lactation Mix"]].map(([val, label]) => (
              <TouchableOpacity key={val}
                style={{ flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: newFeed.feed_type === val ? "#E1F5EE" : "#fff", borderRadius: 8, marginBottom: 6, borderWidth: 0.5, borderColor: newFeed.feed_type === val ? "#1D9E75" : "#D3D1C7" }}
                onPress={() => setNewFeed(f => ({ ...f, feed_type: val }))}>
                <Text style={{ fontSize: 14, color: newFeed.feed_type === val ? "#0F6E56" : "#2C2C2A", fontWeight: newFeed.feed_type === val ? "700" : "400" }}>{label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Stock (kg) *</Text>
            <TextInput style={styles.medInput} value={newFeed.stock_kg} onChangeText={v => setNewFeed(f => ({ ...f, stock_kg: v }))} placeholder="e.g. 50" placeholderTextColor="#B4B2A9" keyboardType="decimal-pad" />
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Daily usage (kg)</Text>
            <TextInput style={styles.medInput} value={newFeed.daily_usage_kg} onChangeText={v => setNewFeed(f => ({ ...f, daily_usage_kg: v }))} placeholder="e.g. 5" placeholderTextColor="#B4B2A9" keyboardType="decimal-pad" />
            <TouchableOpacity style={{ marginTop: 24, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" }} onPress={saveNewFeed} disabled={addingSaving}>
              {addingSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save feed</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Medicine Modal */}
      <Modal visible={addMedModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: "#F8F7F2" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 20, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7", alignItems: "center" }}>
            <Text style={{ fontSize: 17, fontWeight: "700" }}>Add medicine / vitamin</Text>
            <TouchableOpacity onPress={() => setAddMedModal(false)}>
              <Text style={{ color: "#888780" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput style={styles.medInput} value={newMed.name} onChangeText={v => setNewMed(f => ({ ...f, name: v }))} placeholder="e.g. Vitamin C" placeholderTextColor="#B4B2A9" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              {[["antibiotic","Antibiotic"],["antiparasitic","Antiparasitic"],["vitamin","Vitamin"],["vaccine","Vaccine"],["other","Other"]].map(([val, label]) => (
                <TouchableOpacity key={val}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5, borderColor: newMed.category === val ? "#1D9E75" : "#D3D1C7", backgroundColor: newMed.category === val ? "#1D9E75" : "#F8F7F2" }}
                  onPress={() => setNewMed(f => ({ ...f, category: val }))}>
                  <Text style={{ fontSize: 13, color: newMed.category === val ? "#fff" : "#5F5E5A", fontWeight: "500" }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Quantity *</Text>
            <TextInput style={styles.medInput} value={newMed.quantity} onChangeText={v => setNewMed(f => ({ ...f, quantity: v }))} placeholder="e.g. 30" placeholderTextColor="#B4B2A9" keyboardType="number-pad" />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Unit</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {["doses","tabs","vials","sachets","bottles","ml"].map(u => (
                <TouchableOpacity key={u}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 0.5, borderColor: newMed.unit === u ? "#1D9E75" : "#D3D1C7", backgroundColor: newMed.unit === u ? "#1D9E75" : "#F8F7F2" }}
                  onPress={() => setNewMed(f => ({ ...f, unit: u }))}>
                  <Text style={{ fontSize: 13, color: newMed.unit === u ? "#fff" : "#5F5E5A" }}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Low stock alert threshold</Text>
            <TextInput style={styles.medInput} value={newMed.low_stock_threshold} onChangeText={v => setNewMed(f => ({ ...f, low_stock_threshold: v }))} placeholder="e.g. 10" placeholderTextColor="#B4B2A9" keyboardType="number-pad" />

            <TouchableOpacity style={{ marginTop: 24, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" }} onPress={saveNewMedicine} disabled={addingSaving}>
              {addingSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Save medicine</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
 
function FeedCard({ item, usageAmount, setUsageAmount, onLogUsage, restockAmount, setRestockAmount, onRestock }) {
  const isLow = item.days_remaining !== null && item.days_remaining <= 5;
  return (
    <View style={[styles.card, isLow && styles.cardWarning]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.feed_type_display}</Text>
        {isLow && <View style={styles.badgeDanger}><Text style={styles.badgeDangerText}>Low stock</Text></View>}
      </View>
      <Text style={styles.bigValue}>{item.stock_kg} kg</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>Used: {item.daily_usage_kg} kg/day</Text>
        <Text style={styles.meta}>{item.days_remaining !== null ? item.days_remaining + " days left" : "—"}</Text>
      </View>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, {
          width: Math.min(100, (item.days_remaining || 0) / 30 * 100) + "%",
          backgroundColor: isLow ? "#EF9F27" : "#1D9E75",
        }]} />
      </View>
      {/* Use today */}
      <Text style={{ fontSize: 11, color: "#888780", marginTop: 12, marginBottom: 4 }}>Log usage</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: "#F8F7F2", borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 0.5, borderColor: "#D3D1C7", color: "#2C2C2A" }}
          placeholder="kg used today"
          placeholderTextColor="#B4B2A9"
          keyboardType="decimal-pad"
          value={usageAmount[item.id] || ""}
          onChangeText={(v) => setUsageAmount(prev => ({ ...prev, [item.id]: v }))}
        />
        <TouchableOpacity style={styles.logBtn} onPress={onLogUsage}>
          <Text style={styles.logBtnText}>Use</Text>
        </TouchableOpacity>
      </View>

      {/* Restock */}
      <Text style={{ fontSize: 11, color: "#888780", marginTop: 10, marginBottom: 4 }}>Restock</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          style={{ flex: 1, backgroundColor: "#F8F7F2", borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 0.5, borderColor: "#D3D1C7", color: "#2C2C2A" }}
          placeholder="kg to add"
          placeholderTextColor="#B4B2A9"
          keyboardType="decimal-pad"
          value={restockAmount[item.id] || ""}
          onChangeText={(v) => setRestockAmount(prev => ({ ...prev, [item.id]: v }))}
        />
        <TouchableOpacity
          style={[styles.logBtn, { backgroundColor: "#E1F5EE" }]}
          onPress={onRestock}
        >
          <Text style={[styles.logBtnText, { color: "#0F6E56" }]}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
 
function MedCard({ item, onUpdate }) {
  const [amount, setAmount] = useState("");

  return (
    <View style={[styles.card, item.is_low_stock && styles.cardWarning]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardSub}>{item.category_display}</Text>
        </View>
        {item.is_low_stock && (
          <View style={styles.badgeDanger}>
            <Text style={styles.badgeDangerText}>Low stock</Text>
          </View>
        )}
      </View>

      <Text style={styles.bigValue}>
        {item.quantity} <Text style={styles.unit}>{item.unit}</Text>
      </Text>

      {item.expiry_date && (
        <Text style={styles.meta}>Expires: {item.expiry_date}</Text>
      )}

      {/* Stock update controls */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }}>
        <TextInput
          style={{
            flex: 1, backgroundColor: "#F8F7F2", borderRadius: 8,
            padding: 10, fontSize: 14, borderWidth: 0.5,
            borderColor: "#D3D1C7", color: "#2C2C2A",
          }}
          placeholder="Amount"
          placeholderTextColor="#B4B2A9"
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />
        <TouchableOpacity
          style={[styles.logBtn, { paddingHorizontal: 12 }]}
          onPress={() => { onUpdate("deduct", amount); setAmount(""); }}
        >
          <Text style={styles.logBtnText}>Use</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.logBtn, { paddingHorizontal: 12, backgroundColor: "#E1F5EE" }]}
          onPress={() => { onUpdate("restock", amount); setAmount(""); }}
        >
          <Text style={[styles.logBtnText, { color: "#0F6E56" }]}>Restock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2" },
  tabRow: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#D3D1C7" },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#1D9E75" },
  tabText: { fontSize: 13, color: "#888780", fontWeight: "500" },
  tabTextActive: { color: "#1D9E75", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: "#D3D1C7" },
  cardWarning: { borderColor: "#EF9F27", borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#2C2C2A" },
  cardSub: { fontSize: 12, color: "#888780", marginTop: 1 },
  bigValue: { fontSize: 26, fontWeight: "700", color: "#2C2C2A" },
  unit: { fontSize: 14, fontWeight: "400", color: "#888780" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  meta: { fontSize: 12, color: "#888780" },
  progressBg: { height: 6, backgroundColor: "#E8E7E0", borderRadius: 3, marginTop: 10, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  logBtn: { backgroundColor: "#E1F5EE", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  logBtnText: { color: "#0F6E56", fontWeight: "600", fontSize: 13 },
  badgeDanger: { backgroundColor: "#FAEEDA", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDangerText: { color: "#854F0B", fontSize: 11, fontWeight: "600" },
  fieldLabel: { fontSize: 13, color: "#5F5E5A", marginBottom: 6, fontWeight: "500" },
  medInput: { backgroundColor: "#fff", borderRadius: 10, padding: 12, fontSize: 14, color: "#2C2C2A", borderWidth: 0.5, borderColor: "#D3D1C7" },
});
