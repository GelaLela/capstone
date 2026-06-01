// ─── Piglytics Design System ─────────────────────────────────────────────────
// Inspired by modern farm app UI: clean greens, rounded cards, warm accents

export const COLORS = {
  // Primary greens
  primary:       "#3D7A3A",
  primaryDark:   "#2C5A2A",
  primaryLight:  "#EBF5E9",
  primaryMid:    "#5A9E56",

  // Status colors
  healthy:       "#4CAF50",
  healthyBg:     "#E8F5E9",
  warning:       "#FF9800",
  warningBg:     "#FFF3E0",
  danger:        "#F44336",
  dangerBg:      "#FFEBEE",
  info:          "#6C63FF",
  infoBg:        "#EDE7F6",

  // Neutrals
  white:         "#FFFFFF",
  offWhite:      "#F8FAF7",
  cardBg:        "#FFFFFF",
  border:        "#E8EDE8",
  borderLight:   "#F0F5F0",

  // Text
  textPrimary:   "#1A2E1A",
  textSecondary: "#5A7A5A",
  textMuted:     "#8FA88F",
  textOnGreen:   "#FFFFFF",

  // Accents
  amber:         "#F59E0B",
  amberBg:       "#FFFBEB",
  purple:        "#7C3AED",
  purpleBg:      "#EDE9FE",
  pink:          "#EC4899",
  pinkBg:        "#FCE7F3",
  blue:          "#3B82F6",
  blueBg:        "#EFF6FF",

  // Background
  screenBg:      "#F2F7F1",
};

export const FONTS = {
  regular:  { fontFamily: "System", fontWeight: "400" },
  medium:   { fontFamily: "System", fontWeight: "500" },
  semibold: { fontFamily: "System", fontWeight: "600" },
  bold:     { fontFamily: "System", fontWeight: "700" },
  heavy:    { fontFamily: "System", fontWeight: "800" },
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: "#1A2E1A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#1A2E1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#1A2E1A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Pig stage badge colors
export const STAGE_COLORS = {
  piglet:   { bg: "#EDE9FE", text: "#7C3AED" },
  weaner:   { bg: "#FEF3C7", text: "#D97706" },
  grower:   { bg: "#DBEAFE", text: "#1D4ED8" },
  finisher: { bg: "#D1FAE5", text: "#065F46" },
  breeder:  { bg: "#FCE7F3", text: "#BE185D" },
};

export const STATUS_COLORS = {
  healthy:        { bg: "#E8F5E9", text: "#2E7D32", dot: "#4CAF50" },
  under_treatment:{ bg: "#FFF3E0", text: "#E65100", dot: "#FF9800" },
  critical:       { bg: "#FFEBEE", text: "#B71C1C", dot: "#F44336" },
};
