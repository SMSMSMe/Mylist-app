// views/budget.js — three pie charts (Spent / Planned / Combined) + category legend.

import * as S from "../state.js";
import { formatMoney, calcItemPrice, escapeHtml, renderIconHtml } from "../constants.js";

let chartInstance = null;
let uiState = { scope: "planned", listId: "all" };

function categoryColor(name) {
  const st = S.getState();
  const cat = st.categories.find((c) => c.name === name);
  return cat ? cat.color : "#9A9182";
}
function categoryIcon(name) {
  const st = S.getState();
  const cat = st.categories.find((c) => c.name === name);
  return cat ? renderIconHtml(cat.icon) : "🏷️";
}

function aggregateBreakdown(listIds, scope) {
  const st = S.getState();
  const mode = st.settings.chartCalcMode || "midpoint";
  // Exclude wishlist from budget
  const items = st.items.filter((i) =>
    listIds.includes(i.listId) &&
    i.priority !== "wishlist" &&
    (scope === "combined" || (scope === "spent" ? i.checked : !i.checked))
  );
  const map = new Map();
  for (const i of items) {
    const key = i.category || "Uncategorized";
    const lineTotal = calcItemPrice(i.priceMin, i.priceMax, i.qty, mode);
    map.set(key, (map.get(key) || 0) + lineTotal);
  }
  return Array.from(map.entries())
    .map(([category, value]) => ({ category, value }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function renderBudget(container, nav) {
  const st = S.getState();
  const mode = st.settings.chartCalcMode || "midpoint";
  const listIds = uiState.listId === "all" ? st.lists.map((l) => l.id) : [uiState.listId];

  const grand = listIds.reduce((acc, id) => {
    const t = S.getListTotals(id);
    acc.spent += t.spent; acc.planned += t.planned;
    return acc;
  }, { spent: 0, planned: 0 });

  const breakdown = aggregateBreakdown(listIds, uiState.scope);
  const scopeTotal = breakdown.reduce((s, b) => s + b.value, 0);

  const calcModeLabel = { midpoint: "Midpoint (avg)", high: "High (max)", low: "Low (min)" }[mode] || mode;

  container.innerHTML = `
    <h1 style="font-size:20px;margin:4px 0 14px">Budget</h1>

    <div class="field"><label>List</label>
      <select id="budgetListSel">
        <option value="all" ${uiState.listId === "all" ? "selected" : ""}>All lists combined</option>
        ${st.lists.map((l) => `<option value="${l.id}" ${uiState.listId === l.id ? "selected" : ""}>${renderIconHtml(l.icon)} ${escapeHtml(l.name)}</option>`).join("")}
      </select>
    </div>

    <div class="totals-bar">
      <div><div class="t-label">Already spent</div><div class="t-val tabular" style="font-size:16px">${formatMoney(grand.spent)}</div></div>
      <div><div class="t-label">Still planned</div><div class="t-val tabular" style="font-size:16px">${formatMoney(grand.planned)}</div></div>
      <div><div class="t-label">Combined</div><div class="t-val tabular">${formatMoney(grand.spent + grand.planned)}</div></div>
    </div>

    <div class="filter-chips" id="scopeChips">
      <button data-scope="spent"    class="${uiState.scope === "spent"    ? "active" : ""}">Spent</button>
      <button data-scope="planned"  class="${uiState.scope === "planned"  ? "active" : ""}">Planned</button>
      <button data-scope="combined" class="${uiState.scope === "combined" ? "active" : ""}">Combined</button>
    </div>

    <div class="budget-mode-note">Price range mode: <strong>${calcModeLabel}</strong> — change in Settings</div>

    <div class="card" style="padding:18px;text-align:center">
      ${breakdown.length === 0
        ? `<div class="empty-state"><div class="e-icon">📊</div><div>No priced items for this view.</div></div>`
        : `<canvas id="budgetChart" height="220"></canvas>`}
    </div>

    ${breakdown.length ? `
      <div class="card" style="margin-top:10px;padding:6px 14px">
        ${breakdown.map((b) => `
          <div class="item-row">
            <span style="width:10px;height:10px;border-radius:50%;background:${categoryColor(b.category)};flex-shrink:0"></span>
            <span style="flex:1">${categoryIcon(b.category)} ${escapeHtml(b.category)}</span>
            <span class="tabular" style="color:var(--text-dim);font-size:12.5px">${scopeTotal ? Math.round((b.value / scopeTotal) * 100) : 0}%</span>
            <span class="tabular" style="font-weight:600">${formatMoney(b.value)}</span>
          </div>`).join("")}
      </div>` : ""}
  `;

  container.querySelector("#budgetListSel").addEventListener("change", (e) => {
    uiState.listId = e.target.value; renderBudget(container, nav);
  });
  container.querySelectorAll("#scopeChips button").forEach((b) => {
    b.addEventListener("click", () => { uiState.scope = b.dataset.scope; renderBudget(container, nav); });
  });

  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const canvas = container.querySelector("#budgetChart");
  if (canvas && window.Chart) {
    chartInstance = new window.Chart(canvas.getContext("2d"), {
      type: "pie",
      data: {
        labels: breakdown.map((b) => b.category),
        datasets: [{ data: breakdown.map((b) => b.value), backgroundColor: breakdown.map((b) => categoryColor(b.category)) }],
      },
      options: {
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed)}` } },
        },
      },
    });
  }
}
