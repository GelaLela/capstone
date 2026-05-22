import AsyncStorage from "@react-native-async-storage/async-storage";

// !! CHANGE THIS to your PC's WiFi IP address !!
// Example: "http://192.168.1.5:8000/api"
const BASE_URL = "http://192.168.1.4:8000/api";

async function getHeaders() {
  const token = await AsyncStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

async function request(method, endpoint, body = null) {
  const headers = await getHeaders();
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  // DELETE requests return 204 No Content — no JSON to parse
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("POST", "/auth/token/", { username, password }),
  getDashboard: (farmId) => request("GET", `/farms/${farmId}/dashboard/`),
  getWeather: (farmId) => request("GET", `/farms/${farmId}/weather/`),
  getPigs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request("GET", `/pigs/${query ? "?" + query : ""}`);
  },
  getPig: (id) => request("GET", `/pigs/${id}/`),
  createPig: (data) => request("POST", "/pigs/", data),
  updatePig: (id, data) => request("PATCH", `/pigs/${id}/`, data),
  deletePig: (id) => request("DELETE", `/pigs/${id}/`),
  getPigGrowthChart: (id) => request("GET", `/pigs/${id}/growth_chart/`),
  logWeight: (pigId, data) => request("POST", `/pigs/${pigId}/weights/`, data),
  getWeights: (pigId) => request("GET", `/pigs/${pigId}/weights/`),
  getVaccinations: (pigId) => request("GET", `/pigs/${pigId}/vaccinations/`),
  addVaccination: (pigId, data) => request("POST", `/pigs/${pigId}/vaccinations/`, data),
  getDiseases: (pigId) => request("GET", `/pigs/${pigId}/diseases/`),
  addDisease: (pigId, data) => request("POST", `/pigs/${pigId}/diseases/`, data),
  getBreeding: () => request("GET", "/breeding/"),
  addBreeding: (data) => request("POST", "/breeding/", data),
  updateBreeding: (id, data) => request("PATCH", `/breeding/${id}/`, data),
  getFeed: () => request("GET", "/feed/"),
  updateFeed: (id, data) => request("PATCH", `/feed/${id}/`, data),
  logFeedUsage: (id, amountKg) => request("POST", `/feed/${id}/log_usage/`, { amount_kg: amountKg }),
  getMedicine: () => request("GET", "/medicine/"),
  updateMedicineStock: (id, action, amount) =>
    request("POST", `/medicine/${id}/update_stock/`, { action, amount }),
  addMedicine: (data) => request("POST", "/medicine/", data),
  updateMedicine: (id, data) => request("PATCH", `/medicine/${id}/`, data),
  getHealthLogs:  (pigId)       => request("GET",  `/pigs/${pigId}/health-logs/`),
  addHealthLog:   (pigId, data) => request("POST", `/pigs/${pigId}/health-logs/`, data),
  getNotifications: () => request("GET", "/notifications/"),
  markRead: (id) => request("POST", `/notifications/${id}/mark_read/`),
  markAllRead: () => request("POST", "/notifications/mark_all_read/"),
  getBreedingForecast: () => request("GET", "/breeding/forecast/"),
  getHealthLogs:  (pigId)       => request("GET",  `/pigs/${pigId}/health-logs/`),
  addHealthLog:   (pigId, data) => request("POST", `/pigs/${pigId}/health-logs/`, data),
  recordFarrowing:   (id, data) => request("POST", `/breeding/${id}/record_farrowing/`, data),
  getSowPerformance: ()         => request("GET",  "/breeding/sow_performance/"),
  scheduleVaccination: (pigId, data) => request("POST", `/pigs/${pigId}/vaccinations/schedule/`, data),
  addFeed: (data) => request("POST", "/feed/", data),
};