// constants.js — shared lookup data and small formatting helpers.

export const ICON_CATEGORIES = [
  { label: "Shopping & Food", icons: [
    "🧺","🛒","🥦","🍎","🍞","🧀","🍗","🐟","🥫","🧊","🥤","☕","🍳","🥖","🍫","🧂",
    "🍋","🌶️","🥕","🧅","🥑","🍇","🍓","🫐","🥝","🍑","🍒","🍌","🍉","🍊","🥥","🫒",
    "🌽","🥔","🧄","🫑","🥬","🥒","🍆","🫛","🥚","🧈","🍦","🧁","🍰","🍪","🍩","🍕",
    "🍔","🌮","🍜","🍣","🍱","🥗","🫕","🍲","🧆","🥙","🌯","🧃","🍵","🫖","🍺","🍷",
    "🥂","🍾","🧋","🥛","🍶",
  ]},
  { label: "Household", icons: [
    "🧻","🧴","🧽","🧼","🪣","🧹","🪠","🪤","🗑️","🏠","🛋️","🪑","🛏️","🚿","🛁","🪞",
    "🚪","🪟","💡","🔌","🔋","🧯","🪜","🧲","🔑","🗝️","🔒","🪝","🕯️","🪆",
  ]},
  { label: "Tools", icons: [
    "🔧","🔩","🪛","🔨","⚒️","🛠️","⛏️","🪚","🔗","⛓️","📦","🗂️",
  ]},
  { label: "Electronics", icons: [
    "📱","💻","🖥️","⌨️","🖱️","📷","📸","🎧","🎮","📺","📻","⌚","🔭","🔬","💾","💿","📀","🔦",
  ]},
  { label: "Clothing", icons: [
    "👕","👖","🧦","👟","👠","👗","🧥","🧣","🧤","🧢","👒","🎩","👜","👝","🎒","🧳","💄",
    "✂️","🧵","🧶","🪡",
  ]},
  { label: "Health", icons: [
    "💊","🩺","🩹","🪥","💈","🏋️","🏃","🚴","🧘","⚽","🏀","🎾","🏊","🥊","🏅",
  ]},
  { label: "Office & School", icons: [
    "✏️","📚","📖","📝","📌","📎","🖊️","📐","📏","📁","📂","📋","📊","📈","📉","🖇️","📫",
  ]},
  { label: "Travel & Nature", icons: [
    "🚗","✈️","🚂","🛳️","🚌","🏕️","🗺️","🧭","🎫","🌱","🪴","🌲","🌸","🌺","🌻","🌹",
    "🍀","🍃","🌿","🐾","🐕","🐈","🐠","🐦","🌙","☀️","⭐","🌈","❄️",
  ]},
  { label: "Misc", icons: [
    "🎁","🎉","❤️","🏷️","💰","💳","🎯","🔖","📍","🎀","🌟","💎","🔮","🎲","🃏",
  ]},
];

export const ICONS = ICON_CATEGORIES.flatMap((c) => c.icons);

export const COLORS = [
  "#2F6B4F","#D14B3D","#D9A227","#5B7FA6","#8E5BAE",
  "#C4708E","#3F8C8C","#A6763D","#5C6BC0","#6B6259",
];

export const DEFAULT_CATEGORIES = [
  { name: "Produce", icon: "🥦", color: "#2F6B4F" },
  { name: "Dairy & Eggs", icon: "🧀", color: "#D9A227" },
  { name: "Meat & Seafood", icon: "🍗", color: "#D14B3D" },
  { name: "Bakery", icon: "🍞", color: "#A6763D" },
  { name: "Pantry", icon: "🥫", color: "#8E5BAE" },
  { name: "Frozen", icon: "🧊", color: "#5B7FA6" },
  { name: "Beverages", icon: "🥤", color: "#3F8C8C" },
  { name: "Household", icon: "🧻", color: "#5C6BC0" },
  { name: "Personal Care", icon: "🧴", color: "#C4708E" },
  { name: "Other", icon: "🏷️", color: "#6B6259" },
];

export const PRIORITY = {
  now:      { label: "Need Now",   color: "var(--now)",    tint: "var(--now-tint)",    order: 0 },
  soon:     { label: "Need Soon",  color: "var(--soon)",   tint: "var(--soon-tint)",   order: 1 },
  norush:   { label: "No Rush",    color: "var(--norush)", tint: "var(--norush-tint)", order: 2 },
  wishlist: { label: "Wishlist",   color: "var(--wish)",   tint: "var(--wish-tint)",   order: 3 },
};

export const PRIORITY_ORDER = ["now", "soon", "norush", "wishlist"];

export const ESCALATION_CHAIN = {
  wishlist: "norush",
  norush:   "soon",
  soon:     "now",
  now:      null,
};

export const DEFAULT_UNITS = ["pcs","kg","g","meter","cm","liter","ml","pack","box","bag","pair","dozen"];

export const THEMES = [
  { id: "dark",          label: "Dark",          group: "Dark"  },
  { id: "ash",           label: "Ash",           group: "Dark"  },
  { id: "charcoal",      label: "Charcoal",      group: "Dark"  },
  { id: "slate",         label: "Slate",         group: "Dark"  },
  { id: "obsidian",      label: "Obsidian",      group: "Dark"  },
  { id: "mocha",         label: "Mocha",         group: "Dark"  },
  { id: "graphite",      label: "Graphite",      group: "Dark"  },
  { id: "deep-olive",    label: "Deep Olive",    group: "Dark"  },
  { id: "dusk",          label: "Dusk",          group: "Dark"  },
  { id: "true-black",    label: "True Black",    group: "Dark"  },
  { id: "light",         label: "Light",         group: "Light" },
  { id: "parchment",     label: "Parchment",     group: "Light" },
  { id: "fog",           label: "Fog",           group: "Light" },
  { id: "limestone",     label: "Limestone",     group: "Light" },
  { id: "chalk",         label: "Chalk",         group: "Light" },
  { id: "nord",          label: "Nord",          group: "Other" },
  { id: "sepia",         label: "Sepia",         group: "Other" },
  { id: "high-contrast", label: "High Contrast", group: "Other" },
];

export const CURRENCY_SYMBOL = "৳";

/** Render icon — handles both emoji strings and custom "__custom:text:bg:fg" format */
export function renderIconHtml(icon) {
  if (!icon) return "🏷️";
  if (icon.startsWith("__custom:")) {
    const [, text, bg, fg] = icon.split(":");
    return `<span class="custom-icon" style="background:${decodeURIComponent(bg)};color:${decodeURIComponent(fg)}">${escapeHtml(decodeURIComponent(text))}</span>`;
  }
  return icon;
}

/** Plain-text icon for contexts that can't render HTML, e.g. <option> labels */
export function iconPlainText(icon) {
  if (!icon) return "🏷️";
  if (icon.startsWith("__custom:")) {
    const [, text] = icon.split(":");
    return decodeURIComponent(text) || "🏷️";
  }
  return icon;
}

export function formatMoney(amount) {
  const n = Number(amount) || 0;
  const rounded = Math.round(n * 100) / 100;
  const str = rounded.toLocaleString("en-US", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOL}${str}`;
}

export function calcItemPrice(priceMin, priceMax, qty = 1, mode = "midpoint") {
  const min = Number(priceMin) || 0;
  const max = Number(priceMax) || 0;
  if (!min && !max) return 0;
  let unit;
  if (!max || max <= min) unit = min;
  else if (mode === "high")     unit = max;
  else if (mode === "low")      unit = min;
  else                          unit = (min + max) / 2;
  return unit * (Number(qty) || 1);
}

export function formatPriceRange(priceMin, priceMax, qty = 1) {
  const min = Number(priceMin) || 0;
  const max = Number(priceMax) || 0;
  if (!min && !max) return "";
  const q = Number(qty) || 1;
  if (!max || max <= min) return formatMoney(min * q);
  return `${formatMoney(min * q)}–${formatMoney(max * q)}`;
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " (overdue)";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
