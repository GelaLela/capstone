/**
 * frontend/src/services/api.js
 *
 * Issue 1 fix — correct error propagation:
 *
 * BEFORE (broken):
 *   The outer catch re-threw everything that wasn't prefixed "Request failed:"
 *   as "Unable to connect to the server." This meant that a deliberate
 *   throw new Error("Incorrect username...") from inside the if (!res.ok) block
 *   was caught by the outer catch and replaced with the network error message.
 *
 * AFTER (fixed):
 *   Errors thrown from the if (!res.ok) block are tagged with a special prefix
 *   "API_ERROR:" so the outer catch can re-throw them unchanged.
 *   Only genuine fetch/network failures become the "Unable to connect" message.
 *
 * This means LoginScreen receives:
 *   "Incorrect username or password..."  → for 400 bad credentials
 *   "Unable to connect to the server."   → for genuine network failures
 *   "Something went wrong on the server" → for 500 errors
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://192.168.1.4:8000/api";

export function getBaseUrl() { return BASE_URL; }

async function getHeaders() {
  const token = await AsyncStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

/**
 * Central HTTP request function.
 * All API errors are thrown with human-readable messages.
 * Network failures are caught separately from API-level errors.
 */
async function request(method, endpoint, body = null) {
  let res;
  try {
    const headers = await getHeaders();
    const config  = { method, headers };
    if (body) config.body = JSON.stringify(body);
    res = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (_) {
    // fetch() itself failed — genuine network/connection error
    throw new Error("Unable to connect to the server. Please check your internet connection and try again.");
  }

  // Server responded but with an error status
  if (!res.ok) {
    let errMsg;
    try {
      const err = await res.json();
      errMsg = err.error || err.detail || err.message || null;
    } catch (_) {
      errMsg = null;
    }

    // Use the server's message if we got one, otherwise generate based on status
    if (!errMsg) {
      if (res.status === 400) errMsg = "The information entered is not valid. Please check and try again.";
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
  login:    (username, password) => request("POST", "/auth/login/",    { username, password }),
  register: (data)               => request("POST", "/auth/register/", data),
  logout:   ()                   => request("POST", "/auth/logout/"),

  // ── Farm & Dashboard ──────────────────────────────────────────────────────
  getDashboard: (farmId) => request("GET", `/farms/${farmId}/dashboard/`),
  getWeather:   (farmId) => request("GET", `/farms/${farmId}/weather/`),

  // ── Pigs ──────────────────────────────────────────────────────────────────
  getPigs: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/pigs/${q ? "?" + q : ""}`);
  },
  getPig:    (id)       => request("GET",    `/pigs/${id}/`),
  createPig: (data)     => request("POST",   "/pigs/", data),
  updatePig: (id, data) => request("PATCH",  `/pigs/${id}/`, data),
  deletePig: (id)       => request("DELETE", `/pigs/${id}/`),

  // ── Weight & Health ───────────────────────────────────────────────────────
  logWeight:     (pigId, data) => request("POST", `/pigs/${pigId}/weights/`, data),
  getWeights:    (pigId)       => request("GET",  `/pigs/${pigId}/weights/`),
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
  getFarmerAnalytics: (userId) => request("GET", `/admin/farmer-analytics/${userId}/`),
};