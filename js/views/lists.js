// views/lists.js — home overview, list detail, item add/edit.

import * as S from "../state.js";
import {
  escapeHtml, formatMoney, formatPriceRange, calcItemPrice, formatDate, todayISO,
  renderIconHtml, PRIORITY, PRIORITY_ORDER, DEFAULT_UNITS,
} from "../constants.js";
import {
  openSheet, closeSheet, showToast,
  colorPickerHtml, wireColorPicker,
  iconPickerHtml, wireIconPicker,
  priorityPickerHtml, wirePriorityPicker,
  priorityTagHtml,
} from "../ui.js";

/* ====== List overview ====== */

export function renderLists(container, nav) {
  const st = S.getState();

  container.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Mylist</h1>
    </div>
    <div id="listsContainer">
      ${st.lists.length === 0
        ? `<div class="empty-state"><div class="e-icon">🧺</div><div>No lists yet. Tap + to create one.</div></div>`
        : st.lists.map((list) => listChipHtml(list, st)).join("")}
    </div>
    <button class="fab-btn" id="addListBtn" aria-label="New list">+</button>
  `;

  container.querySelector("#addListBtn").addEventListener("click", () => openNewListSheet(nav));
  container.querySelectorAll(".list-chip").forEach((chip) => {
    chip.addEventListener("click", () => nav.goTo("lists", { listId: chip.dataset.listId }));
  });
  container.querySelectorAll(".list-chip-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const list = st.lists.find((l) => l.id === btn.dataset.listId);
      if (list) openEditListSheet(list, nav);
    });
  });
}

function listChipHtml(list, st) {
  const progress = S.getListProgress(list.id);
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const itemsLabel = `${progress.completed}/${progress.total} done`;

  return `
    <div class="list-chip" data-list-id="${list.id}"
      style="background:${list.color}26;border-color:${list.color}55;--list-color:${list.color}">
      <div class="chip-icon" style="background:${list.color}40;color:${list.color}">
        ${renderIconHtml(list.icon)}
      </div>
      <div class="chip-body">
        <div class="chip-title">${escapeHtml(list.name)}</div>
        <div class="chip-sub">${itemsLabel}</div>
        <div class="list-progress-wrap">
          <div class="list-progress-bar">
            <div class="list-progress-fill" style="width:${pct}%;background:${list.color}"></div>
          </div>
        </div>
      </div>
      <button class="list-chip-edit" data-list-id="${list.id}" aria-label="Edit">✎</button>
    </div>
  `;
}

/* ====== New / Edit list sheet ====== */

function openNewListSheet(nav) {
  let icon = "🧺", color = "#2F6B4F";
  openSheet(`
    <div class="sheet-section">
      <div class="field"><label>List name</label>
        <input id="newListName" type="text" class="text-input" placeholder="e.g. Groceries" autofocus />
      </div>
      <div class="field"><label>Icon</label>
        ${iconPickerHtml(icon, "newListIcon")}
      </div>
      <div class="field"><label>Color</label>
        ${colorPickerHtml(color, "newListColor")}
      </div>
      <button class="btn-brand btn-full" id="newListSave">Create List</button>
    </div>
  `, { title: "New List" });

  wireIconPicker("newListIcon", (v) => { icon = v; });
  wireColorPicker("newListColor", (v) => { color = v; });

  document.getElementById("newListSave").addEventListener("click", async () => {
    const name = document.getElementById("newListName").value.trim();
    if (!name) return showToast("List name is required");
    const list = await S.createList({ name, icon, color });
    closeSheet();
    nav.goTo("lists", { listId: list.id });
  });
}

function openEditListSheet(list, nav) {
  let icon = list.icon, color = list.color;
  openSheet(`
    <div class="sheet-section">
      <div class="field"><label>List name</label>
        <input id="editListName" type="text" class="text-input" value="${escapeHtml(list.name)}" />
      </div>
      <div class="field"><label>Icon</label>
        ${iconPickerHtml(icon, "editListIcon")}
      </div>
      <div class="field"><label>Color</label>
        ${colorPickerHtml(color, "editListColor")}
      </div>
      <button class="btn-brand btn-full" id="editListSave">Save</button>
      <button class="btn-danger btn-full" id="editListDelete">Delete List</button>
    </div>
  `, { title: "Edit List" });

  wireIconPicker("editListIcon", (v) => { icon = v; });
  wireColorPicker("editListColor", (v) => { color = v; });

  document.getElementById("editListSave").addEventListener("click", async () => {
    const name = document.getElementById("editListName").value.trim();
    if (!name) return showToast("List name is required");
    await S.updateList(list.id, { name, icon, color });
    closeSheet();
    nav.render();
  });
  document.getElementById("editListDelete").addEventListener("click", async () => {
    if (!confirm(`Delete "${list.name}" and all its items?`)) return;
    await S.deleteList(list.id);
    closeSheet();
    nav.goTo("lists", {});
  });
}

/* ====== List detail ====== */

let detailState = { sortBy: "category", search: "", storeFilter: "all", showChecked: false };

export function renderListDetail(container, nav, listId) {
  const st = S.getState();
  const list = st.lists.find((l) => l.id === listId);
  if (!list) { nav.goTo("lists", {}); return; }

  const { unchecked, checked } = S.getItemsForList(listId, {
    sortBy: detailState.sortBy,
    search: detailState.search,
    storeFilter: detailState.storeFilter,
  });

  const wishlistCount = st.items.filter((i) => i.listId === listId && i.priority === "wishlist").length;
  const wishlistHidden = list.wishlistHidden !== false;

  container.innerHTML = `
    <div class="view-header" style="--list-color:${list.color}">
      <button class="btn-back" id="backBtn">‹</button>
      <h1 class="view-title" style="color:${list.color}">${renderIconHtml(list.icon)} ${escapeHtml(list.name)}</h1>
    </div>

    <div class="filter-row">
      <input type="search" id="detailSearch" class="search-input" placeholder="Search…" value="${escapeHtml(detailState.search)}" />
      <select id="detailSort" class="filter-select">
        <option value="category" ${detailState.sortBy === "category" ? "selected" : ""}>Category</option>
        <option value="priority" ${detailState.sortBy === "priority" ? "selected" : ""}>Priority</option>
        <option value="date"     ${detailState.sortBy === "date"     ? "selected" : ""}>Due date</option>
      </select>
    </div>

    <div id="itemsList">
      ${unchecked.length === 0 && checked.length === 0
        ? `<div class="empty-state"><div class="e-icon">✅</div><div>All done — or tap + to add items.</div></div>`
        : itemsHtml(unchecked, st)}
      ${checked.length > 0 ? `
        <button class="checked-toggle" id="checkedToggle">
          ${detailState.showChecked ? "▾" : "▸"} ${checked.length} checked
        </button>
        ${detailState.showChecked ? itemsHtml(checked, st, true) : ""}
      ` : ""}
    </div>

    <button class="fab-btn" id="detailAddBtn" aria-label="Add item" style="background:${list.color}">+</button>

    <div class="wishlist-toggle-bar">
      <button class="wishlist-toggle-btn" id="wishlistToggle" style="border-color:${list.color}20">
        ${wishlistHidden ? `🌟 Show Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ""}` : "✕ Hide Wishlist"}
      </button>
    </div>
  `;

  // Events
  container.querySelector("#backBtn").addEventListener("click", () => nav.goTo("lists", {}));
  container.querySelector("#detailAddBtn").addEventListener("click", () => openItemSheet(null, listId, nav));
  container.querySelector("#detailSearch").addEventListener("input", (e) => {
    detailState.search = e.target.value;
    renderListDetail(container, nav, listId);
  });
  container.querySelector("#detailSort").addEventListener("change", (e) => {
    detailState.sortBy = e.target.value;
    renderListDetail(container, nav, listId);
  });
  container.querySelector("#checkedToggle")?.addEventListener("click", () => {
    detailState.showChecked = !detailState.showChecked;
    renderListDetail(container, nav, listId);
  });
  container.querySelector("#wishlistToggle").addEventListener("click", async () => {
    await S.updateList(listId, { wishlistHidden: !wishlistHidden });
    renderListDetail(container, nav, listId);
  });

  wireItemRowEvents(container, listId, nav);
}

function itemsHtml(items, st, isChecked = false) {
  if (!items.length) return "";
  return items.map((item) => itemRowHtml(item, st, isChecked)).join("");
}

function itemRowHtml(item, st, isChecked) {
  const cat = st.categories.find((c) => c.name === item.category);
  const dotColor = cat?.color || "var(--text-dim)";
  const priceStr = formatPriceRange(item.priceMin, item.priceMax, item.qty);
  const qtyLabel = item.qty && item.qty !== 1 ? `${item.qty}${item.unit ? " " + item.unit : ""}` : (item.unit || "");

  return `
    <div class="item-row${isChecked ? " item-checked" : ""}" data-item-id="${item.id}">
      <button class="item-check${item.checked ? " checked" : ""}" data-toggle="${item.id}"
        style="--check-c:${item.checked ? dotColor : "var(--border)"}">
        ${item.checked ? "✓" : ""}
      </button>
      <div class="item-body" data-edit="${item.id}">
        <div class="item-name">${escapeHtml(item.name)}
          ${item.favorite ? `<span class="fav-star">★</span>` : ""}
        </div>
        <div class="item-meta">
          ${item.category ? `<span class="cat-dot" style="background:${dotColor}"></span><span>${escapeHtml(item.category)}</span>` : ""}
          ${qtyLabel ? `<span class="item-qty-badge">${escapeHtml(qtyLabel)}</span>` : ""}
          ${priceStr ? `<span class="item-price">${priceStr}</span>` : ""}
          ${item.dueDate ? `<span class="item-due">${formatDate(item.dueDate)}</span>` : ""}
          ${item.escalationDate ? `<span class="escalation-badge">⏫ ${formatDate(item.escalationDate)}</span>` : ""}
        </div>
        ${priorityTagHtml(item.priority)}
      </div>
      <button class="item-fav${item.favorite ? " active" : ""}" data-fav="${item.id}">★</button>
    </div>
  `;
}

function wireItemRowEvents(container, listId, nav) {
  container.querySelectorAll("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => S.toggleChecked(btn.dataset.toggle));
  });
  container.querySelectorAll("[data-edit]").forEach((el) => {
    el.addEventListener("click", () => {
      const item = S.getState().items.find((i) => i.id === el.dataset.edit);
      if (item) openItemSheet(item, listId, nav);
    });
  });
  container.querySelectorAll("[data-fav]").forEach((btn) => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); S.toggleFavorite(btn.dataset.fav); });
  });
}

/* ====== Item add/edit sheet ====== */

function openItemSheet(item, listId, nav) {
  const isEdit = !!item;
  const st = S.getState();
  const allUnits = [...DEFAULT_UNITS, ...(st.settings.customUnits || [])];
  let pickedPriority = item?.priority || "soon";
  let pickedUnit = item?.unit || "";

  // Suggest defaults from history
  const suggestion = !isEdit && item?.name ? S.suggestForName(item.name) : null;
  const defPriceMin = item?.priceMin ?? suggestion?.priceMin ?? 0;
  const defPriceMax = item?.priceMax ?? suggestion?.priceMax ?? 0;

  const nameHistory = [...new Set(st.items.map((i) => i.name))];
  const stores = st.stores.map((s) => s.name);
  const cats   = st.categories.map((c) => c.name);

  openSheet(`
    <div class="sheet-section">
      <div class="field">
        <label>Item name</label>
        <input id="itemName" type="text" class="text-input" list="itemNameList"
          value="${escapeHtml(item?.name || "")}" placeholder="e.g. Milk" autofocus />
        <datalist id="itemNameList">
          ${nameHistory.map((n) => `<option value="${escapeHtml(n)}">`).join("")}
        </datalist>
      </div>

      <div class="field-row">
        <div class="field" style="flex:1"><label>Qty</label>
          <input id="itemQty" type="number" class="text-input" min="0.01" step="0.01"
            value="${item?.qty ?? 1}" />
        </div>
        <div class="field" style="flex:2"><label>Unit</label>
          <div class="unit-chips" id="unitChips">
            ${allUnits.map((u) => `<button class="unit-chip${u === pickedUnit ? " active" : ""}" data-unit="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join("")}
            <button class="unit-chip${pickedUnit === "" ? " active" : ""}" data-unit="">none</button>
          </div>
        </div>
      </div>

      <div class="field"><label>Priority</label>
        ${priorityPickerHtml(pickedPriority, "itemPriority")}
      </div>

      <div class="field-row">
        <div class="field" style="flex:1">
          <label>Min price (৳)</label>
          <input id="itemPriceMin" type="number" class="text-input" min="0" step="0.01"
            value="${defPriceMin || ""}" placeholder="0" />
        </div>
        <div class="field" style="flex:1">
          <label>Max price (৳)</label>
          <input id="itemPriceMax" type="number" class="text-input" min="0" step="0.01"
            value="${defPriceMax || ""}" placeholder="optional" />
        </div>
      </div>

      <div class="field">
        <label>Category</label>
        <select id="itemCategory" class="text-input">
          <option value="">— none —</option>
          ${cats.map((c) => `<option ${item?.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
      </div>

      <div class="field">
        <label>Store</label>
        <input id="itemStore" type="text" class="text-input" list="storeList"
          value="${escapeHtml(item?.store || "")}" placeholder="optional" />
        <datalist id="storeList">
          ${stores.map((s) => `<option value="${escapeHtml(s)}">`).join("")}
        </datalist>
      </div>

      <div class="field-row">
        <div class="field" style="flex:1">
          <label>Due date</label>
          <input id="itemDue" type="date" class="text-input" value="${item?.dueDate || ""}" min="${todayISO()}" />
        </div>
        <div class="field" style="flex:1">
          <label>Escalate on</label>
          <input id="itemEscalate" type="date" class="text-input" value="${item?.escalationDate || ""}" min="${todayISO()}"
            title="Auto-bump priority on this date" />
        </div>
      </div>

      <div class="field"><label>Note</label>
        <textarea id="itemNote" class="text-input" rows="2" placeholder="optional">${escapeHtml(item?.note || "")}</textarea>
      </div>

      <button class="btn-brand btn-full" id="itemSave">${isEdit ? "Save Changes" : "Add Item"}</button>
      ${isEdit ? `<button class="btn-danger btn-full" id="itemDelete">Delete Item</button>` : ""}
    </div>
  `, { title: isEdit ? "Edit Item" : "Add Item" });

  wirePriorityPicker("itemPriority", (v) => { pickedPriority = v; });

  // Unit chips
  const unitChips = document.getElementById("unitChips");
  unitChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".unit-chip");
    if (!chip) return;
    unitChips.querySelectorAll(".unit-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    pickedUnit = chip.dataset.unit;
  });

  document.getElementById("itemSave").addEventListener("click", async () => {
    const name = document.getElementById("itemName").value.trim();
    if (!name) return showToast("Name is required");
    const priceMin = parseFloat(document.getElementById("itemPriceMin").value) || 0;
    const priceMax = parseFloat(document.getElementById("itemPriceMax").value) || 0;
    if (priceMax > 0 && priceMax < priceMin) return showToast("Max price must be ≥ min price");

    const payload = {
      name,
      qty: parseFloat(document.getElementById("itemQty").value) || 1,
      unit: pickedUnit,
      priority: pickedPriority,
      priceMin,
      priceMax,
      category: document.getElementById("itemCategory").value,
      store: document.getElementById("itemStore").value.trim(),
      dueDate: document.getElementById("itemDue").value || null,
      escalationDate: document.getElementById("itemEscalate").value || null,
      note: document.getElementById("itemNote").value.trim(),
    };

    if (isEdit) await S.updateItem(item.id, payload);
    else await S.createItem({ listId, ...payload });
    closeSheet();
  });

  document.getElementById("itemDelete")?.addEventListener("click", async () => {
    await S.deleteItem(item.id);
    closeSheet();
  });
}
