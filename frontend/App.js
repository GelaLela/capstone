/**
 * frontend/App.js
 * Updated: FarmerAnalyticsScreen added to AdminDashStack.
 */
import React, { useEffect } from "react";
import {
  ActivityIndicator, View, Text, BackHandler, Alert,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "./src/theme";
import { AuthProvider, useAuth } from "./src/context/AuthContext";

// ── Auth screens ──────────────────────────────────────────────────────────────
import LoginScreen    from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

// ── Farmer screens ────────────────────────────────────────────────────────────
import DashboardScreen      from "./src/screens/DashboardScreen";
import PigListScreen        from "./src/screens/PigListScreen";
import PigDetailScreen      from "./src/screens/PigDetailScreen";
import AddPigScreen         from "./src/screens/AddPigScreen";
import BreedingScreen       from "./src/screens/BreedingScreen";
import InventoryScreen      from "./src/screens/InventoryScreen";
import AnalyticsScreen      from "./src/screens/AnalyticsScreen";
import NotificationsScreen  from "./src/screens/NotificationsScreen";
import ForecastScreen       from "./src/screens/ForecastScreen";
import HealthLogScreen      from "./src/screens/HealthLogScreen";

// ── Admin screens ─────────────────────────────────────────────────────────────
import AdminDashboardScreen  from "./src/screens/AdminDashboardScreen";
import AuditLogScreen        from "./src/screens/AuditLogScreen";
import FarmerAnalyticsScreen from "./src/screens/FarmerAnalyticsScreen";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HEADER = {
  headerStyle:      { backgroundColor: COLORS.primary },
  headerTintColor:  COLORS.white,
  headerTitleStyle: { fontWeight: "700", fontSize: 17 },
  headerShadowVisible: false,
};

function TI({ e }) { return <Text style={{ fontSize: 20 }}>{e}</Text>; }

// ─────────────────────────────────────────────────────────────────────────────
// FARMER STACKS
// ─────────────────────────────────────────────────────────────────────────────

function DashStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain"  component={DashboardScreen} />
      <Stack.Screen name="Notifications"  component={NotificationsScreen}
        options={{ ...HEADER, title: "Alerts", headerShown: true }} />
    </Stack.Navigator>
  );
}

function PigStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="PigList"   component={PigListScreen}   options={{ title: "My Pigs" }} />
      <Stack.Screen name="PigDetail" component={PigDetailScreen}
        options={({ route }) => ({ title: route.params?.pig?.name || "Pig Detail" })} />
      <Stack.Screen name="AddPig"    component={AddPigScreen}    options={{ title: "Add New Pig" }} />
      <Stack.Screen name="HealthLog" component={HealthLogScreen} options={{ title: "Health Log"  }} />
    </Stack.Navigator>
  );
}

function BreedingStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="BreedingMain" component={BreedingScreen} options={{ title: "Breeding" }} />
    </Stack.Navigator>
  );
}

function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="InventoryMain" component={InventoryScreen} options={{ title: "Inventory" }} />
    </Stack.Navigator>
  );
}

function AnalyticsStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="AnalyticsMain" component={AnalyticsScreen} options={{ title: "Analytics" }} />
    </Stack.Navigator>
  );
}

function ForecastStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="ForecastMain" component={ForecastScreen} options={{ title: "Forecasting" }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FARMER NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────

function FarmerNavigator() {
  useEffect(() => {
    const h = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Exit Piglytics", "Are you sure you want to exit?", [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => h.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1, borderTopColor: COLORS.border,
          paddingBottom: 6, paddingTop: 4, height: 60,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600", marginTop: 1 },
      }}
    >
      <Tab.Screen name="Home"      component={DashStack}      options={{ tabBarIcon: () => <TI e="🏠"/>, tabBarLabel: "Home"      }} />
      <Tab.Screen name="Pigs"      component={PigStack}       options={{ tabBarIcon: () => <TI e="🐷"/>, tabBarLabel: "Pigs"      }} />
      <Tab.Screen name="Breeding"  component={BreedingStack}  options={{ tabBarIcon: () => <TI e="🌸"/>, tabBarLabel: "Breeding"  }} />
      <Tab.Screen name="Inventory" component={InventoryStack} options={{ tabBarIcon: () => <TI e="📦"/>, tabBarLabel: "Inventory" }} />
      <Tab.Screen name="Analytics" component={AnalyticsStack} options={{ tabBarIcon: () => <TI e="📊"/>, tabBarLabel: "Analytics" }} />
      <Tab.Screen name="Forecast"  component={ForecastStack}  options={{ tabBarIcon: () => <TI e="🔮"/>, tabBarLabel: "Forecast"  }} />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN STACKS
// ─────────────────────────────────────────────────────────────────────────────

function AdminDashStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
      {/* AuditLog and FarmerAnalytics are reachable by navigation.navigate() from AdminDashboard */}
      <Stack.Screen name="AuditLog" component={AuditLogScreen}
        options={{ ...HEADER, title: "Audit Logs", headerShown: true }} />
      <Stack.Screen name="FarmerAnalytics" component={FarmerAnalyticsScreen}
        options={({ route }) => ({
          ...HEADER,
          title: route.params?.farmer?.full_name
            ? `${route.params.farmer.full_name} — Analytics`
            : "Farmer Analytics",
          headerShown: true,
        })} />
    </Stack.Navigator>
  );
}

function AdminAuditStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="AuditLogMain" component={AuditLogScreen} options={{ title: "Audit Logs" }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────

function AdminNavigator() {
  useEffect(() => {
    const h = BackHandler.addEventListener("hardwareBackPress", () => {
      Alert.alert("Exit Piglytics Admin", "Are you sure you want to exit?", [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    });
    return () => h.remove();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1, borderTopColor: COLORS.border,
          paddingBottom: 6, paddingTop: 4, height: 60,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600", marginTop: 1 },
      }}
    >
      <Tab.Screen name="AdminHome"  component={AdminDashStack}  options={{ tabBarIcon: () => <TI e="🖥️"/>, tabBarLabel: "Dashboard"  }} />
      <Tab.Screen name="AdminAudit" component={AdminAuditStack} options={{ tabBarIcon: () => <TI e="📋"/>, tabBarLabel: "Audit Logs" }} />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────

function RootNavigator() {
  const { token, isAdmin, checking } = useAuth();
  const [showRegister, setShowRegister] = React.useState(false);

  if (checking) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg }}>
      <Text style={{ fontSize: 64, marginBottom: 16 }}>🐷</Text>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ marginTop: 12, fontSize: 14, color: COLORS.textMuted, fontWeight: "500" }}>
        Loading Piglytics...
      </Text>
    </View>
  );

  if (!token) {
    if (showRegister) return (
      <RegisterScreen onBack={() => setShowRegister(false)} />
    );
    return (
      <LoginScreen onRegister={() => setShowRegister(true)} />
    );
  }

  return (
    <NavigationContainer key={token}>
      {isAdmin ? <AdminNavigator /> : <FarmerNavigator />}
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}