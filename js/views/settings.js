// views/settings.js — settings, categories, stores, units, themes, backup.

import * as S from "../state.js";
import {
  escapeHtml, renderIconHtml, THEMES, DEFAULT_UNITS, PRIORITY,
} from "../constants.js";
import {
  openSheet, closeSheet, showToast,
  colorPickerHtml, wireColorPicker,
  iconPickerHtml, wireIconPicker,
  infoBtn, wireInfoBtns,
} from "../ui.js";
import { downloadBackup, importBackup, Store, uid } from "../db.js";
import { exportICS, requestPermission } from "../notify.js";

const INFO = {
  theme:         "Changes the overall look of the app — background, surfaces, and text. Doesn't affect list or category colors.",
  chartCalcMode: "When items have a price range (min–max), this controls which value is used in the budget pie chart: Low = min price, High = max price, Midpoint = average of both.",
  recipesEnabled:"Shows or hides the Recipes and Meal Plan tabs.",
  pinLock:       "Require a PIN to open the app. Keeps your lists private.",
  notifications: "Allow Mylist to send push notifications for escalated priorities and items due today.",
  customUnits:   "Add extra unit options (e.g. 'bottle', 'roll') that appear in the unit selector when adding items.",
  exportBackup:  "Download all your lists, items, categories, and settings as a JSON file you can restore later.",
  importBackup:  "Restore from a previously exported JSON backup. This replaces all current data.",
  exportICS:     "Export upcoming items with due dates as a calendar (.ics) file you can import into any calendar app.",
  categories:    "Customize your item categories — name, icon, and color. Category color is shown on items in that category.",
  stores:        "Manage store names you frequently reference when adding items.",
};

export function renderSettings(container, nav) {
  const st = S.getState();
  const s  = st.settings;

  // Theme groups
  const themeGroups = {};
  for (const t of THEMES) {
    if (!themeGroups[t.group]) themeGroups[t.group] = [];
    themeGroups[t.group].push(t);
  }

  const allUnits = [...DEFAULT_UNITS, ...(s.customUnits || [])];
  const customUnitsOnly = s.customUnits || [];

  container.innerHTML = `
    <h1 style="font-size:20px;margin:4px 0 14px">Settings</h1>

    <!-- Theme -->
    <div class="settings-section">
      <div class="settings-section-title">Appearance ${infoBtn(INFO.theme)}</div>
      ${Object.entries(themeGroups).map(([group, themes]) => `
        <div class="theme-group-label">${group}</div>
        <div class="theme-chips">
          ${themes.map((t) => `
            <button class="theme-chip${s.theme === t.id ? " active" : ""}" data-theme="${t.id}">
              <span class="theme-preview theme-prev-${t.id}"></span>
              ${escapeHtml(t.label)}
            </button>`).join("")}
        </div>`).join("")}
    </div>

    <!-- Price range calc mode -->
    <div class="settings-section">
      <div class="settings-section-title">Budget calculation ${infoBtn(INFO.chartCalcMode)}</div>
      <div class="filter-chips" id="calcModeChips">
        <button data-mode="low"      class="${s.chartCalcMode === "low"      ? "active" : ""}">Low</button>
        <button data-mode="midpoint" class="${s.chartCalcMode !== "low" && s.chartCalcMode !== "high" ? "active" : ""}">Midpoint</button>
        <button data-mode="high"     class="${s.chartCalcMode === "high"     ? "active" : ""}">High</button>
      </div>
    </div>

    <!-- Units -->
    <div class="settings-section">
      <div class="settings-section-title">Custom units ${infoBtn(INFO.customUnits)}</div>
      <div class="custom-units-list" id="customUnitsList">
        ${customUnitsOnly.map((u) => `
          <div class="custom-unit-row">
            <span>${escapeHtml(u)}</span>
            <button class="btn-sm btn-danger-ghost" data-del-unit="${escapeHtml(u)}">Remove</button>
          </div>`).join("")}
        ${customUnitsOnly.length === 0 ? `<div class="empty-hint">No custom units yet.</div>` : ""}
      </div>
      <div class="field-row" style="margin-top:8px">
        <input id="newUnitInput" type="text" class="text-input" placeholder="New unit (e.g. bottle)" style="flex:1" />
        <button class="btn-sm btn-brand" id="addUnitBtn">Add</button>
      </div>
    </div>

    <!-- Recipes -->
    <div class="settings-section">
      <div class="settings-row">
        <span>Recipes & meal plan ${infoBtn(INFO.recipesEnabled)}</span>
        <label class="toggle-wrap">
          <input type="checkbox" id="recipesToggle" ${s.recipesEnabled ? "checked" : ""} />
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <!-- Notifications -->
    <div class="settings-section">
      <div class="settings-section-title">Notifications ${infoBtn(INFO.notifications)}</div>
      <button class="btn-sm btn-brand" id="reqNotifBtn">Request permission</button>
      <div id="notifStatus" style="font-size:12px;margin-top:6px;color:var(--text-dim)">
        ${getNotifStatusText()}
      </div>
    </div>

    <!-- PIN lock -->
    <div class="settings-section">
      <div class="settings-section-title">PIN lock ${infoBtn(INFO.pinLock)}</div>
      ${s.pinLock
        ? `<div class="settings-row"><span>PIN is set</span><button class="btn-sm btn-danger-ghost" id="clearPinBtn">Remove</button></div>`
        : `<div class="field-row">
             <input id="newPinInput" type="password" inputmode="numeric" class="text-input" maxlength="8" placeholder="Enter new PIN" style="flex:1" />
             <button class="btn-sm btn-brand" id="setPinBtn">Set PIN</button>
           </div>`}
    </div>

    <!-- Categories -->
    <div class="settings-section">
      <div class="settings-section-title">Categories ${infoBtn(INFO.categories)}</div>
      <div id="catList">
        ${st.categories.map((c) => `
          <div class="cat-row" data-cat-id="${c.id}">
            <span class="cat-icon-preview" style="color:${c.color}">${renderIconHtml(c.icon)}</span>
            <span style="flex:1">${escapeHtml(c.name)}</span>
            <button class="btn-icon" data-edit-cat="${c.id}">✎</button>
          </div>`).join("")}
      </div>
      <button class="btn-sm btn-brand" id="addCatBtn" style="margin-top:8px">+ Add category</button>
    </div>

    <!-- Stores -->
    <div class="settings-section">
      <div class="settings-section-title">Stores ${infoBtn(INFO.stores)}</div>
      <div id="storeList">
        ${st.stores.map((s) => `
          <div class="cat-row">
            <span style="flex:1">${escapeHtml(s.name)}</span>
            <button class="btn-icon btn-danger-ghost" data-del-store="${s.id}">✕</button>
          </div>`).join("")}
      </div>
      <div class="field-row" style="margin-top:8px">
        <input id="newStoreInput" type="text" class="text-input" placeholder="Store name" style="flex:1" />
        <button class="btn-sm btn-brand" id="addStoreBtn">Add</button>
      </div>
    </div>

    <!-- Backup -->
    <div class="settings-section">
      <div class="settings-section-title">Data</div>
      <div class="settings-row">
        <span>Export backup ${infoBtn(INFO.exportBackup)}</span>
        <button class="btn-sm btn-brand" id="exportBtn">Export</button>
      </div>
      <div class="settings-row">
        <span>Import backup ${infoBtn(INFO.importBackup)}</span>
        <button class="btn-sm" id="importBtn">Import</button>
        <input type="file" id="importFile" accept=".json" style="display:none" />
      </div>
      <div class="settings-row">
        <span>Calendar export ${infoBtn(INFO.exportICS)}</span>
        <button class="btn-sm" id="icsBtn">Export .ics</button>
      </div>
    </div>
  `;

  wireInfoBtns(container);

  // Theme
  container.querySelectorAll(".theme-chip").forEach((btn) => {
    btn.addEventListener("click", () => S.updateSettings({ theme: btn.dataset.theme }));
  });

  // Calc mode
  container.querySelectorAll("#calcModeChips button").forEach((btn) => {
    btn.addEventListener("click", () => {
      S.updateSettings({ chartCalcMode: btn.dataset.mode });
      container.querySelectorAll("#calcModeChips button").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });

  // Units
  container.querySelector("#addUnitBtn").addEventListener("click", async () => {
    const inp = container.querySelector("#newUnitInput");
    const val = inp.value.trim();
    if (!val) return;
    const existing = [...DEFAULT_UNITS, ...(S.getState().settings.customUnits || [])];
    if (existing.includes(val)) return showToast("Unit already exists");
    await S.updateSettings({ customUnits: [...(S.getState().settings.customUnits || []), val] });
    inp.value = "";
    renderSettings(container, nav);
  });
  container.querySelectorAll("[data-del-unit]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const u = btn.dataset.delUnit;
      await S.updateSettings({ customUnits: (S.getState().settings.customUnits || []).filter((x) => x !== u) });
      renderSettings(container, nav);
    });
  });

  // Recipes toggle
  container.querySelector("#recipesToggle").addEventListener("change", (e) => {
    S.updateSettings({ recipesEnabled: e.target.checked });
  });

  // Notifications
  container.querySelector("#reqNotifBtn").addEventListener("click", async () => {
    const ok = await requestPermission();
    showToast(ok ? "Notifications enabled ✓" : "Permission denied");
    container.querySelector("#notifStatus").textContent = getNotifStatusText();
  });

  // PIN
  container.querySelector("#setPinBtn")?.addEventListener("click", async () => {
    const pin = container.querySelector("#newPinInput").value.trim();
    if (!pin || pin.length < 4) return showToast("PIN must be at least 4 digits");
    await S.updateSettings({ pinLock: pin });
    showToast("PIN set ✓");
    renderSettings(container, nav);
  });
  container.querySelector("#clearPinBtn")?.addEventListener("click", async () => {
    if (!confirm("Remove PIN lock?")) return;
    await S.updateSettings({ pinLock: null });
    renderSettings(container, nav);
  });

  // Categories
  container.querySelector("#addCatBtn").addEventListener("click", () => openCategorySheet(null, container, nav));
  container.querySelectorAll("[data-edit-cat]").forEach((btn) => {
    const cat = S.getState().categories.find((c) => c.id === btn.dataset.editCat);
    if (cat) btn.addEventListener("click", () => openCategorySheet(cat, container, nav));
  });

  // Stores
  container.querySelector("#addStoreBtn").addEventListener("click", async () => {
    const inp = container.querySelector("#newStoreInput");
    const name = inp.value.trim();
    if (!name) return;
    const store = { id: uid(), name };
    S.getState().stores.push(store);
    await Store.put("stores", store);
    inp.value = "";
    renderSettings(container, nav);
  });
  container.querySelectorAll("[data-del-store]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await Store.delete("stores", btn.dataset.delStore);
      S.getState().stores = S.getState().stores.filter((s) => s.id !== btn.dataset.delStore);
      renderSettings(container, nav);
    });
  });

  // Backup
  container.querySelector("#exportBtn").addEventListener("click", () => downloadBackup().catch((e) => showToast("Export failed: " + e.message)));
  container.querySelector("#importBtn").addEventListener("click", () => container.querySelector("#importFile").click());
  container.querySelector("#importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await importBackup(json, { replaceExisting: true });
      await S.init();
      showToast("Backup restored ✓");
      nav.goTo("lists", {});
    } catch (err) { showToast("Import failed: " + err.message); }
  });
  container.querySelector("#icsBtn").addEventListener("click", () => exportICS());
}

function getNotifStatusText() {
  if (!("Notification" in window)) return "Not supported on this browser.";
  return `Permission: ${Notification.permission}`;
}

function openCategorySheet(cat, container, nav) {
  const isEdit = !!cat;
  let icon  = cat?.icon  || "🏷️";
  let color = cat?.color || "#2F6B4F";

  openSheet(`
    <div class="sheet-section">
      <div class="field"><label>Name</label>
        <input id="catName" type="text" class="text-input" value="${escapeHtml(cat?.name || "")}" placeholder="Category name" autofocus />
      </div>
      <div class="field"><label>Icon</label>
        ${iconPickerHtml(icon, "catIcon")}
      </div>
      <div class="field"><label>Color</label>
        ${colorPickerHtml(color, "catColor")}
      </div>
      <button class="btn-brand btn-full" id="catSave">${isEdit ? "Save" : "Add Category"}</button>
      ${isEdit ? `<button class="btn-danger btn-full" id="catDelete">Delete Category</button>` : ""}
    </div>
  `, { title: isEdit ? "Edit Category" : "New Category" });

  wireIconPicker("catIcon",   (v) => { icon  = v; });
  wireColorPicker("catColor", (v) => { color = v; });

  document.getElementById("catSave").addEventListener("click", async () => {
    const name = document.getElementById("catName").value.trim();
    if (!name) return showToast("Name required");
    if (isEdit) await S.updateCategory(cat.id, { name, icon, color });
    else        await S.createCategory({ name, icon, color });
    closeSheet();
    renderSettings(container, nav);
  });

  document.getElementById("catDelete")?.addEventListener("click", async () => {
    if (!confirm(`Delete "${cat.name}" category?`)) return;
    await S.deleteCategory(cat.id);
    closeSheet();
    renderSettings(container, nav);
  });
}
