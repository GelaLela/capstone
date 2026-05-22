import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!username || !password) {
      Alert.alert("Missing fields", "Please enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.login(username, password);
      if (data.token) {
        await AsyncStorage.setItem("authToken", data.token);
        onLogin(data.token);
      } else {
        Alert.alert("Login failed", "Invalid credentials.");
      }
    } catch (e) {
      Alert.alert("Login failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.logoWrap}>
        <Text style={styles.logoIcon}>🐷</Text>
        <Text style={styles.logoText}>Piglytics</Text>
        <Text style={styles.logoSub}>Smart Piggery Management</Text>
      </View>
      <View style={styles.form}>
        <Text style={styles.fieldLabel}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername}
          placeholder="farmer" placeholderTextColor="#B4B2A9" autoCapitalize="none" autoCorrect={false} />
        <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword}
          placeholder="piglytics123" placeholderTextColor="#B4B2A9" secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Log in</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>Default: farmer / piglytics123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7F2", justifyContent: "center", padding: 24 },
  logoWrap: { alignItems: "center", marginBottom: 40 },
  logoIcon: { fontSize: 64 },
  logoText: { fontSize: 32, fontWeight: "800", color: "#1D9E75", marginTop: 8 },
  logoSub: { fontSize: 14, color: "#888780", marginTop: 4 },
  form: { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: "#D3D1C7" },
  fieldLabel: { fontSize: 13, color: "#5F5E5A", fontWeight: "600", marginBottom: 6 },
  input: { backgroundColor: "#F8F7F2", borderRadius: 10, padding: 13, fontSize: 14, color: "#2C2C2A", borderWidth: 0.5, borderColor: "#D3D1C7" },
  btn: { marginTop: 20, backgroundColor: "#1D9E75", borderRadius: 12, padding: 15, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: "#B4B2A9", textAlign: "center", marginTop: 16 },
});