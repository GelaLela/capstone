import React, { useEffect } from "react";
import {
  ActivityIndicator, View, Text, BackHandler, Alert, Image,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "./src/theme";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import FarmOnboardingScreen from "./src/screens/FarmOnboardingScreen";

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

// ── Tab icon component ────────────────────────────────────────────────────────
// PNG icons are already colored — use opacity only for active/inactive states.
// Never apply tintColor to colored PNG assets.
function TabIcon({ source, focused }) {
  return (
    <Image
      source={source}
      style={{
        width: 22,
        height: 22,
        resizeMode: "contain",
        opacity: focused ? 1.0 : 0.4,
      }}
    />
  );
}

// Pre-require all tab icons once at module level (avoids re-require on every render)
const TAB_ICONS = {
  home:      require("./src/assets/icons/home.png"),
  pig:       require("./src/assets/icons/pig.png"),
  breeding:  require("./src/assets/icons/breeding.png"),
  inventory: require("./src/assets/icons/inventory.png"),
  analytics: require("./src/assets/icons/analytics.png"),
  forecast:  require("./src/assets/icons/forecast.png"),
  admin:     require("./src/assets/icons/admin.png"),
  audit:     require("./src/assets/icons/audit.png"),
};

// ─────────────────────────────────────────────────────────────────────────────
// FARMER STACKS
// ─────────────────────────────────────────────────────────────────────────────

function DashStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain"   component={DashboardScreen} />
      <Stack.Screen name="Notifications"   component={NotificationsScreen}
        options={{ ...HEADER, title: "Alerts", headerShown: true }} />
      <Stack.Screen name="FarmOnboarding"  component={FarmOnboardingScreen}
        options={{ ...HEADER, title: "Farm Setup", headerShown: true }} />
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
      <Stack.Screen name="HealthLog" component={HealthLogScreen} options={{ title: "Health Log" }} />
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
  // useSafeAreaInsets provides bottom inset for devices with home indicator.
  const insets = useSafeAreaInsets();
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
        // tabBarActiveTintColor / tabBarInactiveTintColor only affect the label text.
        // Icon color is handled entirely by opacity inside TabIcon — NOT by tint.
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingBottom: insets.bottom + 6,
          paddingTop: 4,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600", marginTop: 1 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashStack}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.home} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Pigs"
        component={PigStack}
        options={{
          tabBarLabel: "Pigs",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.pig} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Breeding"
        component={BreedingStack}
        options={{
          tabBarLabel: "Breeding",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.breeding} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Inventory"
        component={InventoryStack}
        options={{
          tabBarLabel: "Inventory",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.inventory} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsStack}
        options={{
          tabBarLabel: "Analytics",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.analytics} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Forecast"
        component={ForecastStack}
        options={{
          tabBarLabel: "Forecast",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.forecast} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN STACKS
// ─────────────────────────────────────────────────────────────────────────────

// Bug 1 fix: AdminDashStack no longer contains AuditLog or FarmerAnalytics
// as stack screens. Pushing those screens inside AdminDashStack caused the
// Dashboard tab to remain highlighted when viewing Audit Logs, and made the
// Dashboard tab unresponsive (pressing it did nothing because React Navigation
// thought you were already on AdminHome).
//
// AuditLog is now exclusively owned by AdminAuditStack (the AdminAudit tab).
// FarmerAnalytics is pushed inside AdminAuditStack so it stays in the correct tab.
// AdminDashboardScreen navigates to the tab itself: navigation.navigate("AdminAudit").

function AdminDashStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboardMain" component={AdminDashboardScreen} />
      {/* FarmerAnalyticsScreen lives here — not in AdminAuditStack.
          AdminDashboardScreen navigates here with the farmer param.
          Back button returns to AdminDashboardScreen, not AuditLogs. */}
      <Stack.Screen
        name="FarmerAnalyticsScreen"
        component={FarmerAnalyticsScreen}
        options={{ ...HEADER, headerShown: true, title: "Farmer Analytics" }}
      />
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
  // FIX: useSafeAreaInsets() was missing from AdminNavigator.
  // FarmerNavigator had it but AdminNavigator did not.
  // `insets` was used on two lines inside screenOptions (paddingBottom, height)
  // while never being declared — a ReferenceError in Hermes.
  // In APK release mode this crashes silently with no red screen.
  // Every admin login caused an immediate silent crash.
  const insets = useSafeAreaInsets();

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
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          paddingBottom: insets.bottom + 6,
          paddingTop: 4,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600", marginTop: 1 },
      }}
    >
      <Tab.Screen
        name="AdminHome"
        component={AdminDashStack}
        options={{
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.admin} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="AdminAudit"
        component={AdminAuditStack}
        options={{
          tabBarLabel: "Audit Logs",
          tabBarIcon: ({ focused }) => <TabIcon source={TAB_ICONS.audit} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT NAVIGATOR
// ─────────────────────────────────────────────────────────────────────────────

function RootNavigator() {
  const { token, isAdmin, checking } = useAuth();
  const [showRegister, setShowRegister] = React.useState(false);

  // Bug 2 fix: when the token is cleared (logout), always reset to LoginScreen.
  // Without this, showRegister stays true from a previous registration session
  // and the user lands on RegisterScreen after logout instead of LoginScreen.
  React.useEffect(() => {
    if (!token && !checking) {
      setShowRegister(false);
    }
  }, [token, checking]);

  if (checking) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.screenBg }}>
      <Image
        source={require("./src/assets/icons/pig.png")}
        style={{ width: 64, height: 64, resizeMode: "contain", marginBottom: 16 }}
      />
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
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}