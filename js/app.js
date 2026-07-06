// app.js — boot, routing, tab bar, PIN lock, theme, history navigation.

import * as S from "./state.js";
import { renderLists, renderListDetail } from "./views/lists.js";
import { renderBudget } from "./views/budget.js";
import { renderRecipes } from "./views/recipes.js";
import { renderMealPlan } from "./views/mealplan.js";
import { renderSettings } from "./views/settings.js";
import { renderAllItems } from "./views/allitems.js";
import { showToast } from "./ui.js";
import { updateTodayBadge, notifyTodayItems, requestPermission, notifyEscalations } from "./notify.js";
import { THEMES, renderIconHtml, escapeHtml } from "./constants.js";

// ---- State ----
let current = { tab: "lists", params: {} };
let lastBackTime = 0;

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || "dark");
  // Update meta theme-color
  const isDark = !["light","parchment","fog","limestone","chalk","sepia"].includes(theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = isDark ? "#1B1814" : "#FAF7F0";
}

// ---- Render ----
function render() {
  const st = S.getState();
  if (!st.ready) return;

  applyTheme(st.settings.theme);
  renderTabBar();
  renderMain();
  updateTodayBadge();
}

function renderTabBar() {
  const st = S.getState();
  const tabs = [
    { id: "lists",    icon: "🧺", label: "Lists" },
    { id: "all",      icon: "📋", label: "All" },
    { id: "budget",   icon: "📊", label: "Budget" },
    ...(st.settings.recipesEnabled ? [{ id: "recipes", icon: "🍳", label: "Recipes" }] : []),
    { id: "settings", icon: "⚙️", label: "More" },
  ];

  let bar = document.getElementById("tabBar");
  if (!bar) {
    bar = document.createElement("nav");
    bar.id = "tabBar";
    bar.className = "tab-bar";
    document.getElementById("app").appendChild(bar);
  }

  // Active list color accent
  const activeList = current.tab === "lists" && current.params.listId
    ? st.lists.find((l) => l.id === current.params.listId)
    : null;
  const accentColor = activeList ? activeList.color : "var(--brand)";

  bar.innerHTML = tabs.map((t) => {
    const active = t.id === current.tab;
    return `<button class="tab-btn${active ? " active" : ""}" data-tab="${t.id}"
      style="${active ? `--tab-accent:${accentColor}` : ""}">
      <span class="tab-icon">${t.icon}</span>
      ${t.id === "lists" ? `<span class="tab-badge" id="todayBadge" style="display:none">0</span>` : ""}
      <span class="tab-label">${t.label}</span>
    </button>`;
  }).join("");

  bar.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => goTo(btn.dataset.tab, {}));
  });
}

function renderMain() {
  const st = S.getState();

  let main = document.getElementById("mainContent");
  if (!main) {
    main = document.createElement("div");
    main.id = "mainContent";
    main.className = "main-content";
    const app = document.getElementById("app");
    const bar = document.getElementById("tabBar");
    app.insertBefore(main, bar);
  }

  const nav = { goTo, render };

  switch (current.tab) {
    case "lists":
      if (current.params.listId) renderListDetail(main, nav, current.params.listId);
      else                       renderLists(main, nav);
      break;
    case "all":      renderAllItems(main, nav);      break;
    case "budget":   renderBudget(main, nav);        break;
    case "recipes":  renderRecipes(main, nav);       break;
    case "mealplan": renderMealPlan(main, nav);      break;
    case "settings": renderSettings(main, nav);      break;
    default:         renderLists(main, nav);
  }
}

// ---- Navigation ----
function goTo(tab, params = {}) {
  current = { tab, params };
  const isRoot = tab === "lists" && !params.listId;
  history.pushState({ tab, params, isRoot }, "", isRoot ? "#" : `#${tab}`);
  render();
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", (e) => {
  if (e.state && !e.state.isRoot) {
    current = { tab: e.state.tab, params: e.state.params || {} };
    render();
    return;
  }
  // At root — double-back to exit
  const now = Date.now();
  if (now - lastBackTime < 2200) {
    // Second press — allow exit by not pushing state back
    return;
  }
  lastBackTime = now;
  // Push state back so next back press is caught again
  history.pushState({ tab: current.tab, params: current.params, isRoot: true }, "");
  showToast("Swipe back again to exit");
});

// ---- PIN lock ----
function checkPin(st) {
  if (!st.settings.pinLock) return Promise.resolve(true);
  return new Promise((resolve) => {
    const app = document.getElementById("app");
    app.innerHTML = `
      <div class="pin-screen">
        <div class="pin-icon">🔒</div>
        <div class="pin-title">Enter PIN</div>
        <input type="password" inputmode="numeric" id="pinInput" class="pin-input" maxlength="8" autofocus />
        <div id="pinErr" class="pin-err"></div>
      </div>`;
    const inp = document.getElementById("pinInput");
    inp.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      if (inp.value === String(st.settings.pinLock)) {
        resolve(true);
      } else {
        document.getElementById("pinErr").textContent = "Wrong PIN";
        inp.value = "";
      }
    });
    inp.focus();
  });
}

// ---- Boot ----
async function boot() {
  // Prevent pull-to-refresh flash
  document.body.style.overscrollBehaviorY = "contain";

  await S.init();
  const st = S.getState();

  applyTheme(st.settings.theme);
  await checkPin(st);

  document.getElementById("app").innerHTML = `<div id="mainContent" class="main-content"></div><nav id="tabBar" class="tab-bar"></nav>`;

  // Escalation check
  try {
    const escalated = await S.runEscalation();
    if (escalated.length) notifyEscalations(escalated);
  } catch {}

  // History setup
  current = { tab: "lists", params: {} };
  history.replaceState({ tab: "lists", params: {}, isRoot: true }, "");

  S.subscribe(render);
  render();

  // Request notification permission and fire today alert
  requestPermission().then((granted) => { if (granted) notifyTodayItems(); });

  // Register service worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

boot();
