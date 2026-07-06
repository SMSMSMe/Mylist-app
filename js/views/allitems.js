// views/allitems.js — all items across lists, grouped by priority, with price subtotals & selection mode.

import * as S from "../state.js";
import { PRIORITY, PRIORITY_ORDER, escapeHtml, formatMoney, formatPriceRange, calcItemPrice, renderIconHtml } from "../constants.js";
import { showToast } from "../ui.js";

let uiState = { listFilter: "all", catFilter: "all", selectMode: false, selected: new Set() };

export function renderAllItems(container, nav) {
  const st = S.getState();
  const mode = st.settings.chartCalcMode || "midpoint";

  // Build item list respecting filters
  let items = S.getAllItemsSorted();
  if (uiState.listFilter !== "all") items = items.filter((i) => i.listId === uiState.listFilter);
  if (uiState.catFilter !== "all") items = items.filter((i) => i.category === uiState.catFilter);

  // Group by priority
  const groups = PRIORITY_ORDER.map((key) => ({
    key, info: PRIORITY[key],
    items: items.filter((i) => i.priority === key),
  })).filter((g) => g.items.length > 0);

  // Selected total
  const selItems = uiState.selectMode
    ? st.items.filter((i) => uiState.selected.has(i.id))
    : [];
  const selTotal = selItems.reduce((s, i) => s + calcItemPrice(i.priceMin, i.priceMax, i.qty, mode), 0);

  // All cats for filter
  const allCats = [...new Set(st.items.map((i) => i.category).filter(Boolean))].sort();

  container.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">All Items</h1>
      <div class="all-header-actions">
        <button class="btn-sm${uiState.selectMode ? " btn-brand" : ""}" id="allSelectToggle">
          ${uiState.selectMode ? "✓ Done" : "Select"}
        </button>
      </div>
    </div>

    <div class="filter-row">
      <select id="allListFilter" class="filter-select">
        <option value="all">All Lists</option>
        ${st.lists.map((l) => `<option value="${l.id}" ${uiState.listFilter === l.id ? "selected" : ""}>${renderIconHtml(l.icon)} ${escapeHtml(l.name)}</option>`).join("")}
      </select>
      <select id="allCatFilter" class="filter-select">
        <option value="all">All Categories</option>
        ${allCats.map((c) => `<option value="${c}" ${uiState.catFilter === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
      </select>
    </div>

    ${items.length === 0
      ? `<div class="empty-state"><div class="e-icon">📋</div><div>No pending items.</div></div>`
      : groups.map((g) => {
          const groupTotal = g.items.reduce((s, i) => s + calcItemPrice(i.priceMin, i.priceMax, i.qty, mode), 0);
          return `
            <div class="all-group">
              <div class="all-group-header" style="border-left: 3px solid ${g.info.color}">
                <span class="all-group-label" style="color:${g.info.color}">${g.info.label}</span>
                <span class="all-group-count">${g.items.length} item${g.items.length !== 1 ? "s" : ""}</span>
                ${groupTotal > 0 ? `<span class="all-group-total">${formatMoney(groupTotal)}</span>` : ""}
              </div>
              ${g.items.map((item) => {
                const list = st.lists.find((l) => l.id === item.listId);
                const cat = st.categories.find((c) => c.name === item.category);
                const catColor = cat?.color || "var(--text-dim)";
                const priceStr = formatPriceRange(item.priceMin, item.priceMax, item.qty);
                const isSel = uiState.selected.has(item.id);
                return `
                  <div class="item-row all-item-row${isSel ? " all-item-selected" : ""}"
                    data-item-id="${item.id}" data-list-id="${item.listId}">
                    ${uiState.selectMode
                      ? `<button class="all-item-check${isSel ? " checked" : ""}" data-check="${item.id}" aria-label="Select">
                          ${isSel ? "✓" : ""}
                         </button>`
                      : ""}
                    <div class="all-item-body">
                      <div class="all-item-name">${escapeHtml(item.name)}
                        ${item.unit ? `<span class="item-unit-badge">${escapeHtml(item.unit)}</span>` : ""}
                      </div>
                      <div class="all-item-meta">
                        ${list ? `<span class="all-item-list-tag" style="color:${list.color}">${renderIconHtml(list.icon)} ${escapeHtml(list.name)}</span>` : ""}
                        ${item.category ? `<span style="color:${catColor}">· ${escapeHtml(item.category)}</span>` : ""}
                      </div>
                    </div>
                    <div class="all-item-right">
                      ${priceStr ? `<span class="all-item-price">${priceStr}</span>` : ""}
                      ${item.dueDate ? `<span class="all-item-due">${escapeHtml(item.dueDate)}</span>` : ""}
                    </div>
                    ${!uiState.selectMode ? `<button class="all-item-goto" data-goto-list="${item.listId}" aria-label="Open list">›</button>` : ""}
                  </div>
                `;
              }).join("")}
            </div>
          `;
        }).join("")}
  `;

  // Selection footer
  if (uiState.selectMode) {
    const footer = document.createElement("div");
    footer.className = "all-select-footer";
    footer.innerHTML = `
      <div class="all-sel-info">
        <span>${uiState.selected.size} selected</span>
        ${selTotal > 0 ? `<span>Total: <strong>${formatMoney(selTotal)}</strong></span>` : ""}
      </div>
      <div class="all-sel-actions">
        <button class="btn-sm" id="allSelAll">Select all</button>
        <button class="btn-sm" id="allSelNone">Clear</button>
      </div>
    `;
    container.appendChild(footer);
    container.querySelector("#allSelAll")?.addEventListener("click", () => {
      items.forEach((i) => uiState.selected.add(i.id));
      renderAllItems(container, nav);
    });
    container.querySelector("#allSelNone")?.addEventListener("click", () => {
      uiState.selected.clear();
      renderAllItems(container, nav);
    });
  }

  // Events
  container.querySelector("#allSelectToggle")?.addEventListener("click", () => {
    uiState.selectMode = !uiState.selectMode;
    if (!uiState.selectMode) uiState.selected.clear();
    renderAllItems(container, nav);
  });

  container.querySelector("#allListFilter")?.addEventListener("change", (e) => {
    uiState.listFilter = e.target.value;
    renderAllItems(container, nav);
  });
  container.querySelector("#allCatFilter")?.addEventListener("change", (e) => {
    uiState.catFilter = e.target.value;
    renderAllItems(container, nav);
  });

  container.querySelectorAll("[data-check]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.check;
      if (uiState.selected.has(id)) uiState.selected.delete(id);
      else uiState.selected.add(id);
      renderAllItems(container, nav);
    });
  });

  container.querySelectorAll(".all-item-goto").forEach((btn) => {
    btn.addEventListener("click", () => nav.goTo("lists", { listId: btn.dataset.gotoList }));
  });

  // Tap row to navigate (when not in select mode)
  if (!uiState.selectMode) {
    container.querySelectorAll(".all-item-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".all-item-goto")) return;
        nav.goTo("lists", { listId: row.dataset.listId });
      });
    });
  }
}
