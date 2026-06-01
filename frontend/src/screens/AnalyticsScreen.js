/**
 * frontend/src/screens/AnalyticsScreen.js
 *
 * REDESIGNED: Full analytics platform for the farmer.
 * Calls all four backend analytics endpoints:
 *   GET /api/farms/{id}/health_analytics/
 *   GET /api/farms/{id}/growth_analytics/
 *   GET /api/farms/{id}/breeding_analytics/
 *   GET /api/farms/{id}/feed_analytics/
 *
 * Tabs: Overview | Health | Growth | Breeding | Feed
 *
 * Data audit fixes applied:
 *   - DiseaseRecord.resolved_date → avg_recovery_days KPI
 *   - MedicineInventory.expiry_date → expiring medicines alert
 *   - WeightRecord → ADG benchmark comparison per stage
 *   - PigBaseline → breeding KPIs incorporate historical data immediately
 *   - FarmBaseline → feed forecast uses historical baseline when logs sparse
 *
 * All emojis replaced with PNG icons. No tintColor.
 */
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { COLORS, RADIUS, SHADOW } from "../theme";

const ICONS = {
  pig:       require("../assets/icons/pig.png"),
  health:    require("../assets/icons/pill.png"),
  breeding:  require("../assets/icons/breeding.png"),
  analytics: require("../assets/icons/analytics.png"),
  feeds:     require("../assets/icons/feeds.png"),
  forecast:  require("../assets/icons/forecast.png"),
  pregnant:  require("../assets/icons/pregnant.png"),
  farrowed:  require("../assets/icons/forrowed.png"),
  vaccine:   require("../assets/icons/vaccine.png"),
  bell:      require("../assets/icons/bell.png"),
  inventory: require("../assets/icons/inventory.png"),
  pill:      require("../assets/icons/pill.png"),
  user:      require("../assets/icons/user.png"),
};

const TABS = [
  { key: "overview",  label: "Overview",  icon: "analytics" },
  { key: "health",    label: "Health",    icon: "health"    },
  { key: "growth",    label: "Growth",    icon: "pig"       },
  { key: "breeding",  label: "Breeding",  icon: "breeding"  },
  { key: "feed",      label: "Feed",      icon: "feeds"     },
  { key: "weather",   label: "Weather",   icon: "forecast"  },
];

export default function AnalyticsScreen() {
  const { farmId } = useAuth();
  const [tab,     setTab]     = useState("overview");
  const [loading, setLoading] = useState(true);
  const [health,  setHealth]  = useState(null);
  const [growth,  setGrowth]  = useState(null);
  const [breed,   setBreed]   = useState(null);
  const [feed,    setFeed]    = useState(null);
  const [weather, setWeather] = useState(null);

  useFocusEffect(useCallback(() => {
    if (!farmId) return;
    setLoading(true);
    Promise.all([
      api.getHealthAnalytics(farmId),
      api.getGrowthAnalytics(farmId),
      api.getBreedingAnalytics(farmId),
      api.getFeedAnalytics(farmId),
      api.getWeather(farmId),
    ])
      .then(([h, gr, br, fd, wx]) => {
        setHealth(h);
        setGrowth(gr);
        setBreed(br);
        setFeed(fd);
        setWeather(wx);
      })
      .catch(e => console.error("Analytics:", e.message))
      .finally(() => setLoading(false));
  }, [farmId]));

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={s.screen}>
      {/* Tab strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.tabStrip}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key}
            style={[s.tabPill, tab === t.key && s.tabPillActive]}
            onPress={() => setTab(t.key)}>
            <Image source={ICONS[t.icon]}
              style={[s.tabPillIcon, tab !== t.key && { opacity: 0.4 }]} />
            <Text style={[s.tabPillText, tab === t.key && s.tabPillTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}>

        {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
        {tab === "overview" && health && growth && breed && feed && (
          <>
            {/* Farm Health Score */}
            {(() => {
              const score = health.farm_health_score;
              const color = score >= 80 ? COLORS.healthy : score >= 60 ? COLORS.warning : COLORS.danger;
              const grade = health.health_grade;
              return (
                <SCard>
                  <Row>
                    <Col>
                      <Text style={bigNumStyle(color)}>{score}%</Text>
                      <Text style={[s.bigLabel, { color }]}>{grade}</Text>
                    </Col>
                    <Col flex={2}>
                      <Text style={s.cardTitle}>Farm Health Score</Text>
                      <ProgBar value={score} max={100} color={color} />
                      <Text style={s.sub}>{health.pig_status.healthy} healthy / {health.pig_status.total} pigs</Text>
                      {health.health_risk_index > 5 && (
                        <Alert2 text={`Health risk index: ${health.health_risk_index}/10`} color={COLORS.danger} />
                      )}
                    </Col>
                  </Row>
                </SCard>
              );
            })()}

            {/* Medicine expiry alert — previously unused field */}
            {health.expiring_medicines?.length > 0 && (
              <SCard borderColor={COLORS.danger}>
                <Row>
                  <Image source={ICONS.pill} style={{ width: 20, height: 20, resizeMode: "contain" }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.cardTitle, { color: COLORS.danger }]}>Medicine Expiry Alert</Text>
                    {health.expiring_medicines.map((m, i) => (
                      <Text key={i} style={s.sub}>
                        {m.name} — {m.expired ? "EXPIRED" : `expires in ${m.days_until_expiry} days`} ({m.expiry_date})
                      </Text>
                    ))}
                  </View>
                </Row>
              </SCard>
            )}

            {/* KPI summary row */}
            <View style={s.kpiGrid}>
              <KCard icon="analytics"  label="Farm Avg ADG"   value={growth.farm_avg_adg ? `${growth.farm_avg_adg} kg/d` : "—"}  color={COLORS.primary}  bg={COLORS.primaryLight} />
              <KCard icon="breeding"   label="Avg Litter"     value={breed.avg_litter_size || "—"}                                 color={COLORS.pink}     bg={COLORS.pinkBg} />
              <KCard icon="health"     label="Recovery Rate"  value={`${health.recovery_rate_pct}%`}                              color={COLORS.healthy}  bg={COLORS.healthyBg} />
              <KCard icon="feeds"      label="Feed Stock"     value={feed.stock_summary.length > 0 ? `${feed.stock_summary.reduce((a, f) => a + f.stock_kg, 0).toFixed(0)} kg` : "—"} color={COLORS.amber} bg={COLORS.amberBg} />
            </View>

            {/* Recovery duration — previously unused field */}
            {health.avg_recovery_days != null && (
              <SCard>
                <Text style={s.cardTitle}>Average Recovery Duration</Text>
                <Row>
                  <Text style={bigNumStyle(COLORS.blue)}>{health.avg_recovery_days}</Text>
                  <Col flex={2} style={{ marginLeft: 12 }}>
                    <Text style={s.cardTitle}>days to recover</Text>
                    <Text style={s.sub}>Based on resolved disease records. Lower is better.</Text>
                  </Col>
                </Row>
              </SCard>
            )}

            {/* Sow ranking preview */}
            {breed.sow_ranking?.length > 0 && (
              <SCard>
                <Text style={s.cardTitle}>Top Sow Rankings</Text>
                <Text style={s.sub}>Includes historical baseline litters</Text>
                {breed.sow_ranking.slice(0, 3).map((sow, i) => (
                  <SowRow key={sow.sow_id} sow={sow} rank={i + 1} />
                ))}
              </SCard>
            )}

            {/* Feed shortage alerts */}
            {feed.shortage_alerts?.length > 0 && (
              <SCard borderColor={COLORS.warning}>
                <Row>
                  <Image source={ICONS.feeds} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.cardTitle, { color: COLORS.warning }]}>Feed Shortages</Text>
                    {feed.shortage_alerts.map((a, i) => (
                      <Text key={i} style={s.sub}>
                        {a.feed_type} — ~{a.days_remaining} days left (restock by {a.restock_by})
                      </Text>
                    ))}
                  </View>
                </Row>
              </SCard>
            )}
          </>
        )}

        {/* ── HEALTH ───────────────────────────────────────────────────── */}
        {tab === "health" && health && (
          <>
            {(() => {
              const score = health.farm_health_score;
              const color = score >= 80 ? COLORS.healthy : score >= 60 ? COLORS.warning : COLORS.danger;
              return (
                <SCard>
                  <Text style={s.cardTitle}>Farm Health Score</Text>
                  <Row style={{ marginTop: 10 }}>
                    <Text style={bigNumStyle(color)}>{score}%</Text>
                    <Col flex={2} style={{ marginLeft: 12 }}>
                      <ProgBar value={score} max={100} color={color} />
                      <Row style={{ marginTop: 6, gap: 12 }}>
                        <Stat label="Risk Index" value={`${health.health_risk_index}/10`}
                          color={health.health_risk_index > 5 ? COLORS.danger : COLORS.healthy} />
                        <Stat label="Recovery" value={`${health.recovery_rate_pct}%`} color={COLORS.healthy} />
                        <Stat label="Mortality" value={`${health.mortality_rate_pct}%`} color={COLORS.warning} />
                      </Row>
                    </Col>
                  </Row>
                </SCard>
              );
            })()}

            <View style={s.kpiGrid}>
              <KCard icon="health"  label="Healthy"         value={health.pig_status.healthy}         color={COLORS.healthy} bg={COLORS.healthyBg} />
              <KCard icon="bell"    label="Under Treatment" value={health.pig_status.under_treatment}  color={COLORS.warning} bg={COLORS.warningBg} />
              <KCard icon="pill"    label="Critical"        value={health.pig_status.critical}          color={COLORS.danger}  bg={COLORS.dangerBg} />
              <KCard icon="vaccine" label="Vax Due 7d"      value={health.vaccinations_due_7d}          color={COLORS.purple}  bg={COLORS.purpleBg} />
            </View>

            {/* Recovery duration from resolved_date — previously unused */}
            {health.avg_recovery_days != null && (
              <SCard>
                <Row>
                  <Image source={ICONS.health} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.cardTitle}>Avg Recovery Duration</Text>
                    <Text style={s.sub}>
                      Pigs recover from illness in an average of <Text style={{ fontWeight: "800", color: COLORS.blue }}>{health.avg_recovery_days} days</Text>.
                      Calculated from resolved disease records.
                    </Text>
                  </View>
                </Row>
              </SCard>
            )}

            {/* Medicine expiry — previously unchecked */}
            {health.expiring_medicines?.length > 0 && (
              <SCard borderColor={COLORS.danger}>
                <Text style={[s.cardTitle, { color: COLORS.danger }]}>Medicine Expiry Alerts</Text>
                {health.expiring_medicines.map((m, i) => (
                  <View key={i} style={s.expiryRow}>
                    <Image source={ICONS.pill} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.expiryName}>{m.name}</Text>
                      <Text style={s.sub}>{m.quantity} {m.unit} — {m.expired ? "EXPIRED" : `expires ${m.expiry_date}`}</Text>
                    </View>
                    <Text style={[s.expiryBadge, { backgroundColor: m.expired ? COLORS.dangerBg : COLORS.warningBg, color: m.expired ? COLORS.danger : COLORS.warning }]}>
                      {m.expired ? "Expired" : `${m.days_until_expiry}d`}
                    </Text>
                  </View>
                ))}
              </SCard>
            )}

            {/* Top diseases */}
            <SCard>
              <Text style={s.cardTitle}>Top Diseases (last 90 days)</Text>
              {health.disease_frequency.length === 0
                ? <Empty icon="health" text="No disease records in last 90 days" />
                : <HBarChart data={health.disease_frequency} labelKey="disease" valueKey="count" color={COLORS.danger} />
              }
            </SCard>

            {/* Weekly health log trend */}
            <SCard>
              <Text style={s.cardTitle}>Weekly Health Log Trend</Text>
              {health.health_log_trend.length === 0
                ? <Empty icon="health" text="No health logs recorded yet" />
                : health.health_log_trend.map((w, i) => (
                  <View key={i} style={s.weekRow}>
                    <Text style={s.weekLabel}>{w.week}</Text>
                    <StackBar normal={w.normal} warning={w.warning} critical={w.critical} />
                  </View>
                ))
              }
              {health.health_log_trend.length > 0 && (
                <View style={s.legendRow}>
                  <LegDot color={COLORS.healthy} label="Normal" />
                  <LegDot color={COLORS.warning} label="Warning" />
                  <LegDot color={COLORS.danger}  label="Critical" />
                </View>
              )}
            </SCard>
          </>
        )}

        {/* ── GROWTH ───────────────────────────────────────────────────── */}
        {tab === "growth" && growth && (
          <>
            <SCard>
              <Text style={s.cardTitle}>ADG by Growth Stage vs Benchmark</Text>
              <Text style={s.sub}>Historical weight milestones from onboarding improve accuracy</Text>
              {growth.stage_adg_summary.map(item => (
                <ADGRow key={item.stage} item={item} />
              ))}
            </SCard>

            <SCard>
              <Text style={s.cardTitle}>Underperforming Pigs</Text>
              <Text style={s.sub}>ADG below 80% of stage benchmark</Text>
              {growth.underperformers.length === 0
                ? <Empty icon="pig" text="All pigs meeting growth benchmarks!" />
                : growth.underperformers.map(pig => (
                  <View key={pig.pig_id} style={s.underRow}>
                    <Image source={ICONS.pig} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.underName}>{pig.pig_name} ({pig.pig_id})</Text>
                      <Text style={s.sub}>{pig.stage} — {pig.adg_kg_per_day} kg/d (target {pig.benchmark}) — {pig.efficiency_score}%</Text>
                    </View>
                  </View>
                ))}
            </SCard>

            <SCard>
              <Text style={s.cardTitle}>Market Weight Projections</Text>
              {growth.growth_projections.length === 0
                ? <Empty icon="analytics" text="Need 2+ weight records per pig" />
                : growth.growth_projections.map(pig => (
                  <View key={pig.pig_id} style={s.underRow}>
                    <Image source={ICONS.pig} style={{ width: 18, height: 18, resizeMode: "contain" }} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.underName}>{pig.pig_name}</Text>
                      <Text style={s.sub}>{pig.current_weight_kg} kg → market in {pig.days_to_market} days ({pig.market_date})</Text>
                    </View>
                    <Text style={[s.effBadge, { color: pig.efficiency_score >= 100 ? COLORS.healthy : pig.efficiency_score >= 80 ? COLORS.warning : COLORS.danger }]}>
                      {pig.efficiency_score}%
                    </Text>
                  </View>
                ))}
            </SCard>
          </>
        )}

        {/* ── BREEDING ─────────────────────────────────────────────────── */}
        {tab === "breeding" && breed && (
          <>
            {breed.baseline_litters > 0 && (
              <View style={s.baselineNotice}>
                <Image source={ICONS.analytics} style={{ width: 14, height: 14, resizeMode: "contain" }} />
                <Text style={s.baselineText}>
                  Includes {breed.baseline_litters} historical litters from onboarding. Analytics reflect full breeding history.
                </Text>
              </View>
            )}

            <View style={s.kpiGrid}>
              <KCard icon="analytics" label="Pregnancy Rate"  value={`${breed.pregnancy_success_rate_pct}%`} color={COLORS.blue}    bg={COLORS.blueBg} />
              <KCard icon="farrowed"  label="Farrowing Rate"  value={`${breed.farrowing_success_rate_pct}%`} color={COLORS.healthy} bg={COLORS.healthyBg} />
              <KCard icon="pig"       label="Avg Litter"      value={breed.avg_litter_size}                   color={COLORS.primary} bg={COLORS.primaryLight} />
              <KCard icon="pregnant"  label="Survival Rate"   value={`${breed.survival_rate_pct}%`}           color={COLORS.pink}    bg={COLORS.pinkBg} />
              <KCard icon="breeding"  label="Weaning Rate"    value={`${breed.weaning_rate_pct}%`}            color={COLORS.purple}  bg={COLORS.purpleBg} />
              <KCard icon="farrowed"  label="Total Litters"   value={breed.total_litters}                     color={COLORS.amber}   bg={COLORS.amberBg} />
            </View>

            <SCard>
              <Text style={s.cardTitle}>Monthly Litter Trend</Text>
              {breed.monthly_litter_trend.length === 0
                ? <Empty icon="breeding" text="No farrowing history yet" />
                : <BarCh data={breed.monthly_litter_trend} labelKey="month" valueKey="litters" color={COLORS.pink} />
              }
            </SCard>

            <SCard>
              <Text style={s.cardTitle}>Sow Productivity Rankings</Text>
              <Text style={s.sub}>Score combines litter size × survival rate. Baseline litters included.</Text>
              {breed.sow_ranking.length === 0
                ? <Empty icon="breeding" text="Add breeding records to see sow rankings" />
                : breed.sow_ranking.map((sow, i) => <SowRow key={sow.sow_id} sow={sow} rank={i + 1} />)
              }
            </SCard>
          </>
        )}

        {/* ── FEED ─────────────────────────────────────────────────────── */}
        {tab === "feed" && feed && (
          <>
            {feed.stock_summary.map(fi => {
              const color = fi.status === "critical" ? COLORS.danger : fi.status === "warning" ? COLORS.warning : COLORS.healthy;
              return (
                <SCard key={fi.id} borderColor={color}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={s.cardTitle}>{fi.feed_type_display}</Text>
                    <View style={[s.badge, { backgroundColor: fi.status === "critical" ? COLORS.dangerBg : fi.status === "warning" ? COLORS.warningBg : COLORS.healthyBg }]}>
                      <Text style={[s.badgeText, { color }]}>{fi.status === "critical" ? "Critical" : fi.status === "warning" ? "Low" : "Good"}</Text>
                    </View>
                  </View>
                  <View style={s.feedStats}>
                    <FStat label="Stock"       value={`${fi.stock_kg} kg`} />
                    <FStat label="Daily use"    value={`${fi.effective_daily_kg} kg`} />
                    <FStat label="Days left"    value={fi.days_remaining != null ? `${fi.days_remaining}d` : "∞"} />
                    <FStat label="Monthly cost" value={fi.price_per_kg > 0 ? `₱${fi.monthly_cost}` : "—"} />
                  </View>
                  {fi.used_baseline_rate && (
                    <Text style={[s.sub, { fontStyle: "italic", marginTop: 4 }]}>
                      Using farm baseline rate (not enough usage logs yet)
                    </Text>
                  )}
                </SCard>
              );
            })}

            {feed.stock_summary.length === 0 && <Empty icon="feeds" text="Add feed inventory to see analytics" />}

            <SCard>
              <Text style={s.cardTitle}>Weekly Feed Usage</Text>
              {feed.weekly_usage_trend.length === 0
                ? <Empty icon="feeds" text="Log feed usage to see trends" />
                : <BarCh data={feed.weekly_usage_trend} labelKey="week" valueKey="kg_used" color={COLORS.amber} />
              }
            </SCard>

            {feed.feed_conversion_ratio != null && (
              <SCard>
                <Text style={s.cardTitle}>Feed Conversion Ratio (FCR)</Text>
                <Row style={{ marginTop: 8 }}>
                  <Text style={bigNumStyle(feed.feed_conversion_ratio <= feed.fcr_benchmark ? COLORS.healthy : COLORS.warning)}>
                    {feed.feed_conversion_ratio}
                  </Text>
                  <Col flex={2} style={{ marginLeft: 12 }}>
                    <Text style={s.sub}>Benchmark: {feed.fcr_benchmark}</Text>
                    <Text style={s.sub}>
                      {feed.feed_conversion_ratio <= feed.fcr_benchmark ? "Efficient — below benchmark" : "Review feeding practices"}
                    </Text>
                  </Col>
                </Row>
              </SCard>
            )}

            {feed.total_monthly_cost > 0 && (
              <SCard>
                <Text style={s.cardTitle}>Estimated Monthly Feed Cost</Text>
                <Text style={[bigNumStyle(COLORS.amber), { marginTop: 6 }]}>₱{feed.total_monthly_cost}</Text>
              </SCard>
            )}
          </>
        )}

        {/* ── WEATHER ──────────────────────────────────────────────────────── */}
        {tab === "weather" && (
          <>
            {!weather || weather.temperature_c == null ? (
              <SCard>
                <Empty icon="forecast" text="Weather data unavailable. Check internet connection." />
              </SCard>
            ) : (
              <>
                {/* Current conditions */}
                {(() => {
                  const comfort  = weather.pig_comfort;
                  const status   = comfort?.overall_status || "comfortable";
                  const colors   = {
                    comfortable: COLORS.healthy, mild_warning: COLORS.amber,
                    warning: COLORS.warning, high_risk: COLORS.danger, critical: COLORS.danger,
                  };
                  const bgs = {
                    comfortable: COLORS.healthyBg, mild_warning: COLORS.amberBg,
                    warning: COLORS.warningBg, high_risk: COLORS.dangerBg, critical: COLORS.dangerBg,
                  };
                  const cardColor = colors[status] || COLORS.blue;
                  const cardBg    = bgs[status]    || COLORS.blueBg;
                  const effTemp   = comfort?.effective_temp;
                  const showEff   = effTemp && effTemp > weather.temperature_c;

                  return (
                    <SCard borderColor={cardColor}>
                      <Row>
                        <Col>
                          <Text style={bigNumStyle(cardColor)}>{weather.temperature_c}°C</Text>
                          <Text style={[s.sub, { color: cardColor }]}>{comfort?.overall_label || "Comfortable"}</Text>
                        </Col>
                        <Col flex={2} style={{ marginLeft: 12 }}>
                          <Text style={s.cardTitle}>Current Conditions</Text>
                          <Text style={s.sub}>Humidity: {weather.humidity_percent}%</Text>
                          {showEff && (
                            <Text style={s.sub}>Feels like: {effTemp}°C (humidity-adjusted)</Text>
                          )}
                          {weather.wind_speed_kph != null && (
                            <Text style={s.sub}>Wind: {weather.wind_speed_kph} km/h</Text>
                          )}
                        </Col>
                      </Row>
                      {comfort?.pig_comfort_summary && (
                        <Text style={[s.sub, { marginTop: 8, color: cardColor, fontStyle: "italic" }]}>
                          {comfort.pig_comfort_summary}
                        </Text>
                      )}
                    </SCard>
                  );
                })()}

                {/* Humidity note */}
                {weather.pig_comfort?.humidity_note && (
                  <SCard borderColor={COLORS.warning}>
                    <Row>
                      <Image source={ICONS.bell} style={{ width: 16, height: 16, resizeMode: "contain" }} />
                      <Text style={[s.sub, { flex: 1, marginLeft: 8, color: COLORS.warning }]}>
                        {weather.pig_comfort.humidity_note}
                      </Text>
                    </Row>
                  </SCard>
                )}

                {/* Per-stage risk breakdown */}
                {weather.pig_comfort?.stage_risks?.length > 0 && (
                  <SCard>
                    <Text style={s.cardTitle}>Per-Stage Comfort Analysis</Text>
                    <Text style={[s.sub, { marginBottom: 8 }]}>Based on your farm's actual pig population</Text>
                    {weather.pig_comfort.stage_risks.map((sr, i) => {
                      const srColors = {
                        comfortable: COLORS.healthy, mild_warning: COLORS.amber,
                        warning: COLORS.warning, high_risk: COLORS.danger, critical: COLORS.danger,
                      };
                      const srColor = srColors[sr.status] || COLORS.textMuted;
                      const srBg    = { comfortable: COLORS.healthyBg, mild_warning: COLORS.amberBg, warning: COLORS.warningBg, high_risk: COLORS.dangerBg, critical: COLORS.dangerBg }[sr.status] || COLORS.screenBg;
                      return (
                        <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
                          <Row style={{ marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary, flex: 1 }}>
                              {sr.label} {sr.pig_count ? `(${sr.pig_count} pigs)` : ""}
                            </Text>
                            <View style={[s.badge, { backgroundColor: srBg }]}>
                              <Text style={[s.badgeText, { color: srColor }]}>
                                {sr.status === "comfortable" ? "Comfortable"
                                  : sr.status === "mild_warning" ? "Mild Risk"
                                  : sr.status === "warning" ? "Warning"
                                  : sr.status === "high_risk" ? "High Risk"
                                  : "Critical"}
                              </Text>
                            </View>
                          </Row>
                          <Text style={s.sub}>Comfort zone: {sr.tnz_low}–{sr.tnz_high}°C</Text>
                          {sr.status !== "comfortable" && (
                            <Text style={[s.sub, { color: srColor, marginTop: 4 }]}>{sr.recommendation}</Text>
                          )}
                        </View>
                      );
                    })}
                  </SCard>
                )}

                {/* All active weather alerts */}
                {weather.alerts?.length > 0 && (
                  <SCard>
                    <Text style={s.cardTitle}>Active Alerts ({weather.alerts.length})</Text>
                    {weather.alerts.map((alert, i) => {
                      const alertColor = alert.type === "critical" ? COLORS.danger
                        : alert.type === "warning" || alert.type === "high_risk" ? COLORS.warning
                        : COLORS.blue;
                      return (
                        <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: alertColor }}>{alert.title}</Text>
                          <Text style={[s.sub, { marginTop: 4 }]}>{alert.message}</Text>
                        </View>
                      );
                    })}
                  </SCard>
                )}

                {/* Comfort zone reference */}
                <SCard>
                  <Text style={s.cardTitle}>Pig Comfort Zone Reference</Text>
                  <Text style={[s.sub, { marginBottom: 8 }]}>Industry-standard thermoneutral zones</Text>
                  {[
                    { label: "Newborn / Piglet",      tnz: "30–35°C",  adg: "0.25 kg/day" },
                    { label: "Weaner (3–8 weeks)",    tnz: "21–28°C",  adg: "0.40 kg/day" },
                    { label: "Grower (2–4 months)",   tnz: "18–22°C",  adg: "0.65 kg/day" },
                    { label: "Finisher (5–6 months)", tnz: "18–22°C",  adg: "0.85 kg/day" },
                    { label: "Breeder Sow / Boar",    tnz: "15–21°C",  adg: "0.20 kg/day" },
                  ].map((row, i) => (
                    <Row key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
                      <Text style={{ flex: 2, fontSize: 12, color: COLORS.textPrimary, fontWeight: "500" }}>{row.label}</Text>
                      <Text style={{ flex: 1, fontSize: 12, color: COLORS.primary, fontWeight: "700", textAlign: "right" }}>{row.tnz}</Text>
                      <Text style={{ width: 80, fontSize: 11, color: COLORS.textMuted, textAlign: "right" }}>{row.adg}</Text>
                    </Row>
                  ))}
                  <Text style={[s.sub, { marginTop: 8, fontStyle: "italic" }]}>
                    High humidity (≥70%) amplifies heat stress. Effective temperature may exceed actual reading.
                  </Text>
                </SCard>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── bigNum helper — NOT inside StyleSheet.create (functions not allowed there) ──
// StyleSheet.create() only accepts plain style objects. Using a function inside
// StyleSheet.create() causes it to be silently set to undefined, then calling
// bigNumStyle(color) throws:  "Property 't'/'a' doesn't exist"  in Hermes engine.
// Fix: define bigNum as a plain JS function OUTSIDE StyleSheet.create().
function bigNumStyle(color) {
  return { fontSize: 38, fontWeight: "800", color };
}

function BarCh({ data, labelKey, valueKey, color }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 6, paddingTop: 8 }}>
      {data.map((item, i) => {
        const pct = (item[valueKey] || 0) / max;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", height: "100%" }}>
            <Text style={{ fontSize: 9, color: COLORS.textMuted, marginBottom: 2 }}>{item[valueKey] || 0}</Text>
            <View style={{ flex: 1, width: "80%", backgroundColor: COLORS.borderLight, borderRadius: 4, justifyContent: "flex-end", overflow: "hidden" }}>
              <View style={{ height: `${Math.round(pct * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
            </View>
            <Text style={{ fontSize: 8, color: COLORS.textMuted, marginTop: 3, textAlign: "center" }} numberOfLines={2}>{item[labelKey]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function HBarChart({ data, labelKey, valueKey, color }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {data.map((item, i) => (
        <View key={i}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
            <Text style={{ fontSize: 12, color: COLORS.textPrimary }}>{item[labelKey]}</Text>
            <Text style={{ fontSize: 12, color, fontWeight: "700" }}>{item[valueKey]}</Text>
          </View>
          <View style={{ height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" }}>
            <View style={{ height: 8, width: `${(item[valueKey] / max) * 100}%`, backgroundColor: color, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ProgBar({ value, max = 100, color }) {
  return (
    <View style={{ height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden", marginVertical: 4 }}>
      <View style={{ height: 8, width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color, borderRadius: 4 }} />
    </View>
  );
}

function StackBar({ normal, warning, critical }) {
  return (
    <View style={{ flex: 1, height: 10, flexDirection: "row", borderRadius: 5, overflow: "hidden", backgroundColor: COLORS.borderLight }}>
      {normal   > 0 && <View style={{ flex: normal,   backgroundColor: COLORS.healthy }} />}
      {warning  > 0 && <View style={{ flex: warning,  backgroundColor: COLORS.warning }} />}
      {critical > 0 && <View style={{ flex: critical, backgroundColor: COLORS.danger  }} />}
    </View>
  );
}

function ADGRow({ item }) {
  const color = item.status === "Above" ? COLORS.healthy : item.status === "Near" ? COLORS.warning : COLORS.danger;
  const bm    = item.benchmark;
  const pct   = bm > 0 ? Math.min(120, item.avg_adg / bm * 100) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.textPrimary, textTransform: "capitalize" }}>
          {item.stage} ({item.pig_count} pigs)
        </Text>
        <Text style={{ fontSize: 12, color, fontWeight: "700" }}>
          {item.avg_adg || "—"} kg/d
        </Text>
      </View>
      <ProgBar value={pct} max={100} color={color} />
      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>Benchmark: {bm} kg/d — {item.efficiency_score}% efficiency</Text>
    </View>
  );
}

function SowRow({ sow, rank }) {
  const color = sow.productivity_score >= 80 ? COLORS.healthy : sow.productivity_score >= 60 ? COLORS.blue : sow.productivity_score >= 40 ? COLORS.warning : COLORS.danger;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
      <Text style={{ fontSize: 14, width: 28, color: COLORS.textMuted, fontWeight: "700" }}>#{rank}</Text>
      <Image source={ICONS.pig} style={{ width: 20, height: 20, resizeMode: "contain" }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary }}>{sow.sow_name}</Text>
        <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
          {sow.total_litters} litters ({sow.historical_litters > 0 ? `${sow.historical_litters} historical` : "all live"}) · avg {sow.avg_litter_size} live · {sow.survival_rate}% survival
        </Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: "800", color }}>{sow.productivity_score}</Text>
    </View>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function SCard({ children, borderColor, style }) {
  return (
    <View style={[s.card, borderColor && { borderLeftWidth: 4, borderLeftColor: borderColor }, style]}>
      {children}
    </View>
  );
}
function Row({ children, style }) { return <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>{children}</View>; }
function Col({ children, flex = 1, style }) { return <View style={[{ flex }, style]}>{children}</View>; }
function KCard({ icon, label, value, color, bg }) {
  return (
    <View style={[s.kcard, { backgroundColor: bg }]}>
      <Image source={ICONS[icon]} style={{ width: 18, height: 18, resizeMode: "contain", marginBottom: 6 }} />
      <Text style={[s.kval, { color }]}>{value}</Text>
      <Text style={s.klabel}>{label}</Text>
    </View>
  );
}
function Stat({ label, value, color }) {
  return (
    <View>
      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 16, fontWeight: "800", color: color || COLORS.textPrimary }}>{value}</Text>
    </View>
  );
}
function FStat({ label, value }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</Text>
    </View>
  );
}
function LegDot({ color, label }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{label}</Text>
    </View>
  );
}
function Alert2({ text, color }) {
  return (
    <View style={[s.alertBanner, { backgroundColor: color + "18" }]}>
      <Text style={{ fontSize: 11, color, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}
function Empty({ icon, text }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
      <Image source={ICONS[icon] || ICONS.analytics} style={{ width: 32, height: 32, resizeMode: "contain", opacity: 0.35 }} />
      <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: COLORS.screenBg },
  center:   { flex: 1, justifyContent: "center", alignItems: "center" },
  tabStrip: { backgroundColor: COLORS.white, flexGrow: 0, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabPill:        { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.screenBg },
  tabPillActive:  { backgroundColor: COLORS.primary },
  tabPillIcon:    { width: 13, height: 13, resizeMode: "contain" },
  tabPillText:    { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  tabPillTextActive: { color: COLORS.white, fontWeight: "700" },

  card:     { backgroundColor: COLORS.white, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.sm },
  cardTitle:{ fontSize: 14, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 8 },
  sub:      { fontSize: 11, color: COLORS.textMuted, lineHeight: 16 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kcard:   { width: "47%", borderRadius: RADIUS.xl, padding: 14, ...SHADOW.sm },
  kval:    { fontSize: 20, fontWeight: "800" },
  klabel:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  weekRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  weekLabel:{ fontSize: 11, color: COLORS.textMuted, width: 70 },
  legendRow:{ flexDirection: "row", gap: 16, marginTop: 10, justifyContent: "center" },

  underRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  underName:{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  effBadge: { fontSize: 16, fontWeight: "800", minWidth: 40, textAlign: "right" },

  feedStats: { flexDirection: "row", justifyContent: "space-between" },
  expiryRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  expiryName:{ fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  expiryBadge:{ fontSize: 11, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },

  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, fontWeight: "700" },

  baselineNotice: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10 },
  baselineText:   { flex: 1, fontSize: 11, color: COLORS.primary, lineHeight: 16, fontWeight: "500" },

  alertBanner: { borderRadius: RADIUS.md, padding: 8, marginTop: 6 },
  bigLabel: { fontSize: 13, fontWeight: "700" },
});