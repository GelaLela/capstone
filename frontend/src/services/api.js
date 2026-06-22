import AsyncStorage from "@react-native-async-storage/async-storage";

// ── API BASE URL ──────────────────────────────────────────────────────────────
// LOCAL TESTING (Expo QR code on same WiFi):
//   Use your machine's local IP. Run `ipconfig` (Windows) to find it.
// const BASE_URL = "http://192.168.1.4:8000/api";

// PRODUCTION (PythonAnywhere + APK build):
const BASE_URL = "https://newpiglytics.pythonanywhere.com/api";

export function getBaseUrl() { return BASE_URL; }

// ── Request timeout ───────────────────────────────────────────────────────────
// PythonAnywhere free tier can be slow to respond.
// Without a timeout, fetch() hangs forever and the app freezes.
// 15 seconds is generous enough for slow connections.
const REQUEST_TIMEOUT_MS = 15000;

function fetchWithTimeout(url, options) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Request timed out. The server is taking too long to respond. Please try again."));
    }, REQUEST_TIMEOUT_MS);

    fetch(url, options)
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function getHeaders() {
  const token = await AsyncStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

async function request(method, endpoint, body = null) {
  let res;
  try {
    const headers = await getHeaders();
    const config  = { method, headers };
    if (body) config.body = JSON.stringify(body);
    res = await fetchWithTimeout(`${BASE_URL}${endpoint}`, config);
  } catch (err) {
    // Distinguish timeout from connection refused
    if (err.message && err.message.includes("timed out")) {
      throw new Error("Request timed out. The server is taking too long to respond. Please try again.");
    }
    throw new Error("Unable to connect to the server. Please check your internet connection and try again.");
  }

  if (!res.ok) {
    let errMsg;
    try {
      const err = await res.json();
      errMsg = err.error || err.detail || err.message || null;
    } catch (_) { errMsg = null; }

    if (!errMsg) {
      if      (res.status === 400) errMsg = "The information entered is not valid. Please check and try again.";
      else if (res.status === 401) errMsg = "Your session has expired. Please sign in again.";
      else if (res.status === 403) errMsg = "You do not have permission to perform this action.";
      else if (res.status === 404) errMsg = "The requested information could not be found.";
      else if (res.status >= 500)  errMsg = "Something went wrong on the server. Please try again later.";
      else                         errMsg = `Request failed (${res.status}). Please try again.`;
    }
    throw new Error(errMsg);
  }

  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  return res.json();
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  // IMPORTANT: these URLs must match piggery/urls.py exactly
  login:    (username, password) => request("POST", "/auth/token/",    { username, password }),
  register: (data)               => request("POST", "/auth/register/", data),
  logout:   ()                   => request("POST", "/auth/logout/"),

  // ── Farm & Dashboard ──────────────────────────────────────────────────────
  getDashboard:    (farmId) => request("GET", `/farms/${farmId}/dashboard/`),
  getWeather:      (farmId) => request("GET", `/farms/${farmId}/weather/`),

  // ── Farm Analytics ────────────────────────────────────────────────────────
  getHealthAnalytics:   (farmId) => request("GET", `/farms/${farmId}/health_analytics/`),
  getGrowthAnalytics:   (farmId) => request("GET", `/farms/${farmId}/growth_analytics/`),
  getBreedingAnalytics: (farmId) => request("GET", `/farms/${farmId}/breeding_analytics/`),
  getFeedAnalytics:     (farmId) => request("GET", `/farms/${farmId}/feed_analytics/`),
  getFarmPredictions:   (farmId) => request("GET", `/farms/${farmId}/predictions/`),

  // ── Farm Onboarding ───────────────────────────────────────────────────────
  saveFarmBaseline: (farmId, data) => request("POST", `/farms/${farmId}/save_baseline/`, data),

  // ── Pigs ──────────────────────────────────────────────────────────────────
  getPigs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/pigs/${q ? "?" + q : ""}`);
  },
  getPig:          (id)       => request("GET",    `/pigs/${id}/`),
  createPig:       (data)     => request("POST",   "/pigs/", data),
  updatePig:       (id, data) => request("PATCH",  `/pigs/${id}/`, data),
  deletePig:       (id)       => request("DELETE", `/pigs/${id}/`),
  getNextPigId:    ()         => request("GET",    "/pigs/next_pig_id/"),

  // ── Pig Baseline ──────────────────────────────────────────────────────────
  savePigBaseline: (pigId, data) => request("POST", `/pigs/${pigId}/save_baseline/`, data),
  getPigBaseline:  (pigId)       => request("GET",  `/pigs/${pigId}/baseline/`),

  // ── Weight ────────────────────────────────────────────────────────────────
  logWeight:  (pigId, data) => request("POST", `/pigs/${pigId}/weights/`, data),
  getWeights: (pigId)       => request("GET",  `/pigs/${pigId}/weights/`),

  // ── Health ────────────────────────────────────────────────────────────────
  getHealthLogs: (pigId)       => request("GET",  `/pigs/${pigId}/health-logs/`),
  addHealthLog:  (pigId, data) => request("POST", `/pigs/${pigId}/health-logs/`, data),

  // ── Vaccinations ─────────────────────────────────────────────────────────
  getVaccinations:     (pigId)       => request("GET",  `/pigs/${pigId}/vaccinations/`),
  addVaccination:      (pigId, data) => request("POST", `/pigs/${pigId}/vaccinations/`, data),
  scheduleVaccination: (pigId, data) => request("POST", `/pigs/${pigId}/vaccinations/schedule/`, data),

  // ── Diseases ─────────────────────────────────────────────────────────────
  getDiseases: (pigId)       => request("GET",  `/pigs/${pigId}/diseases/`),
  addDisease:  (pigId, data) => request("POST", `/pigs/${pigId}/diseases/`, data),

  // ── Breeding ─────────────────────────────────────────────────────────────
  getBreeding:         ()         => request("GET",  "/breeding/"),
  addBreeding:         (data)     => request("POST", "/breeding/", data),
  updateBreeding:      (id, data) => request("PATCH",`/breeding/${id}/`, data),
  recordFarrowing:     (id, data) => request("POST", `/breeding/${id}/record_farrowing/`, data),
  markBreedingFailed:  (id, data) => request("POST", `/breeding/${id}/mark_failed/`, data),
  getEligibleSows:     ()         => request("GET",  "/breeding/eligible_sows/"),
  getSowPerformance:   ()         => request("GET",  "/breeding/sow_performance/"),
  getBreedingForecast: ()         => request("GET",  "/breeding/forecast/"),

  // ── Inventory ─────────────────────────────────────────────────────────────
  getFeed:             ()             => request("GET",    "/feed/"),
  addFeed:             (data)         => request("POST",   "/feed/", data),
  updateFeed:          (id, data)     => request("PATCH",  `/feed/${id}/`, data),
  deleteFeed:          (id)           => request("DELETE", `/feed/${id}/`),
  logFeedUsage:        (id, amountKg) => request("POST",   `/feed/${id}/log_usage/`, { amount_kg: amountKg }),
  getMedicine:         ()             => request("GET",    "/medicine/"),
  addMedicine:         (data)         => request("POST",   "/medicine/", data),
  updateMedicine:      (id, data)     => request("PATCH",  `/medicine/${id}/`, data),
  deleteMedicine:      (id)           => request("DELETE", `/medicine/${id}/`),
  updateMedicineStock: (id, action, amount) =>
    request("POST", `/medicine/${id}/update_stock/`, { action, amount }),

  // ── Notifications ─────────────────────────────────────────────────────────
  getNotifications: ()   => request("GET",  "/notifications/"),
  markRead:         (id) => request("POST", `/notifications/${id}/mark_read/`),
  markAllRead:      ()   => request("POST", "/notifications/mark_all_read/"),

  // ── Audit Logs ────────────────────────────────────────────────────────────
  getAuditLogs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/audit-logs/${q ? "?" + q : ""}`);
  },
  downloadAuditCsv:   (p = {}) => `${BASE_URL}/audit-logs/download_csv/?${new URLSearchParams(p)}`,
  downloadAuditExcel: (p = {}) => `${BASE_URL}/audit-logs/download_excel/?${new URLSearchParams(p)}`,
  downloadAuditPdf:   (p = {}) => `${BASE_URL}/audit-logs/download_pdf/?${new URLSearchParams(p)}`,

  // ── Admin ─────────────────────────────────────────────────────────────────
  getAdminStats:     ()   => request("GET",  "/admin/stats/"),
  getAdminFarmers:   ()   => request("GET",  "/admin/farmers/"),
  disableUser:       (id) => request("POST", `/admin/farmers/${id}/disable/`),
  activateUser:      (id) => request("POST", `/admin/farmers/${id}/activate/`),
  resetUserPassword: (id) => request("POST", `/admin/farmers/${id}/reset_password/`),

  // ── Farmer Analytics ─────────────────────────────────────────────────────
  getFarmerAnalytics: (userId) => request("GET", `/admin/analytics/${userId}/`),
};