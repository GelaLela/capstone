import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import PigListScreen from "./src/screens/PigListScreen";
import PigDetailScreen from "./src/screens/PigDetailScreen";
import AddPigScreen from "./src/screens/AddPigScreen";
import BreedingScreen from "./src/screens/BreedingScreen";
import InventoryScreen from "./src/screens/InventoryScreen";
import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import ForecastScreen from "./src/screens/ForecastScreen";
import HealthLogScreen from "./src/screens/HealthLogScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const HEADER = {
  headerStyle: { backgroundColor: "#1D9E75" },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

function DashStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} options={{ title: "Piglytics" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
    </Stack.Navigator>
  );
}

function PigStack() {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="PigList"   component={PigListScreen}   options={{ title: "My Pigs" }} />
      <Stack.Screen name="PigDetail" component={PigDetailScreen} options={({ route }) => ({ title: route.params.pig.name })} />
      <Stack.Screen name="AddPig"    component={AddPigScreen}    options={{ title: "Add new pig" }} />
      <Stack.Screen name="HealthLog" component={HealthLogScreen} options={({ route }) => ({ title: route.params.pig.name + " — Health Log" })} />
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

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#1D9E75",
      tabBarInactiveTintColor: "#888780",
      tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#D3D1C7", paddingBottom: 4 },
      tabBarLabelStyle: { fontSize: 11 },
    }}>
      <Tab.Screen name="Home"      component={DashStack}      options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🏠</Text>, tabBarLabel: "Home" }} />
      <Tab.Screen name="Pigs"      component={PigStack}       options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🐷</Text>, tabBarLabel: "Pigs" }} />
      <Tab.Screen name="Breeding"  component={BreedingStack}  options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🌸</Text>, tabBarLabel: "Breeding" }} />
      <Tab.Screen name="Inventory" component={InventoryStack} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📦</Text>, tabBarLabel: "Inventory" }} />
      <Tab.Screen name="Analytics" component={AnalyticsStack} options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text>, tabBarLabel: "Analytics" }} />
      <Tab.Screen name="Forecast"  component={ForecastStack}  options={{ tabBarIcon: () => <Text style={{ fontSize: 20 }}>🔮</Text>, tabBarLabel: "Forecast" }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [token, setToken]       = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("authToken").then((t) => {
      setToken(t);
      setChecking(false);
    });
  }, []);

  if (checking) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8F7F2" }}>
      <ActivityIndicator size="large" color="#1D9E75" />
    </View>
  );

  if (!token) return <LoginScreen onLogin={(t) => setToken(t)} />;

  return <NavigationContainer><MainTabs /></NavigationContainer>;
}