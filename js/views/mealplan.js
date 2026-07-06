// views/mealplan.js — simple weekly meal planner tied to the recipe box.

import * as S from "../state.js";
import { escapeHtml, iconPlainText } from "../constants.js";
import { openSheet, closeSheet, showToast } from "../ui.js";

let weekOffset = 0;

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoOf(d) {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function renderMealPlan(container, nav) {
  const st = S.getState();
  const base = startOfWeek(new Date());
  base.setDate(base.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });

  const dayLabel = (d) => d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  container.innerHTML = `
    <h1 style="font-size:20px;margin:4px 0 14px">Meal plan</h1>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <button class="btn-icon" id="prevWeek">←</button>
      <div style="font-weight:600;font-size:14px">${dayLabel(days[0])} – ${dayLabel(days[6])}</div>
      <button class="btn-icon" id="nextWeek">→</button>
    </div>
    ${days.map((d) => {
      const iso = isoOf(d);
      const entry = st.mealPlan.find((m) => m.dateISO === iso);
      const recipe = entry ? st.recipes.find((r) => r.id === entry.recipeId) : null;
      return `<div class="list-chip" data-date="${iso}">
        <div class="chip-icon" style="background:var(--brand-tint);color:var(--brand);font-size:14px">${d.toLocaleDateString(undefined, { weekday: "short" })}</div>
        <div class="chip-body">
          <div class="chip-title">${recipe ? escapeHtml(recipe.title) : "Tap to plan a meal"}</div>
          <div class="chip-sub">${dayLabel(d)}</div>
        </div>
      </div>`;
    }).join("")}
    <button class="btn btn-primary btn-block" id="genListBtn" style="margin-top:14px">Generate shopping list for this week</button>
  `;

  container.querySelector("#prevWeek").addEventListener("click", () => { weekOffset -= 1; renderMealPlan(container, nav); });
  container.querySelector("#nextWeek").addEventListener("click", () => { weekOffset += 1; renderMealPlan(container, nav); });

  container.querySelectorAll(".list-chip").forEach((el) => {
    el.addEventListener("click", () => openAssignSheet(el.dataset.date, container, nav));
  });

  container.querySelector("#genListBtn").addEventListener("click", () => openGenerateSheet(days.map(isoOf), container, nav));
}

function openAssignSheet(dateISO, container, nav) {
  const st = S.getState();
  const entry = st.mealPlan.find((m) => m.dateISO === dateISO);

  if (st.recipes.length === 0) {
    openSheet(`<h2>No recipes yet</h2><p style="font-size:14px;color:var(--text-dim)">Add a recipe first on the Recipes tab, then come back to plan it.</p><button class="btn btn-ghost btn-block" id="ok">Got it</button>`, {
      onMount: (root) => root.querySelector("#ok").addEventListener("click", closeSheet),
    });
    return;
  }

  openSheet(`
    <h2>${new Date(dateISO + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h2>
    <div class="field"><label>Recipe</label>
      <select id="recipeSel">
        <option value="">No meal planned</option>
        ${st.recipes.map((r) => `<option value="${r.id}" ${entry && entry.recipeId === r.id ? "selected" : ""}>${escapeHtml(r.title)}</option>`).join("")}
      </select>
    </div>
    <button class="btn btn-primary btn-block" id="saveAssign">Save</button>
  `, {
    onMount: (root) => {
      root.querySelector("#saveAssign").addEventListener("click", async () => {
        const recipeId = root.querySelector("#recipeSel").value;
        if (recipeId) await S.setMealPlan(dateISO, recipeId);
        else await S.clearMealPlan(dateISO);
        closeSheet();
        renderMealPlan(container, nav);
      });
    },
  });
}

function openGenerateSheet(weekIsoDates, container, nav) {
  const st = S.getState();
  const entries = weekIsoDates.map((iso) => st.mealPlan.find((m) => m.dateISO === iso)).filter(Boolean);
  if (entries.length === 0) {
    showToast("No meals planned this week yet");
    return;
  }
  openSheet(`
    <h2>Add this week's ingredients to...</h2>
    <div class="field"><label>List</label><select id="targetList">${st.lists.map((l) => `<option value="${l.id}">${iconPlainText(l.icon)} ${escapeHtml(l.name)}</option>`).join("")}</select></div>
    <button class="btn btn-primary btn-block" id="genBtn">Add ingredients</button>
  `, {
    onMount: (root) => {
      root.querySelector("#genBtn").addEventListener("click", async () => {
        const listId = root.querySelector("#targetList").value;
        for (const entry of entries) await S.addRecipeToList(entry.recipeId, listId);
        closeSheet();
        showToast("Added this week's ingredients to your list");
      });
    },
  });
}
