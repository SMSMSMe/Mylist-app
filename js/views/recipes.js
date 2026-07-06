// views/recipes.js — recipe box: create/edit recipes, scale servings, push ingredients into a list.

import * as S from "../state.js";
import { escapeHtml, iconPlainText } from "../constants.js";
import { openSheet, closeSheet, showToast } from "../ui.js";

export function renderRecipes(container, nav) {
  const st = S.getState();
  container.innerHTML = `
    <h1 style="font-size:20px;margin:4px 0 14px">Recipes</h1>
    ${st.recipes.length === 0
      ? `<div class="empty-state"><div class="e-icon">🍳</div><div>No recipes yet. Tap + to add one.</div></div>`
      : st.recipes.map((r) => `
        <div class="list-chip" data-recipe-id="${r.id}">
          <div class="chip-icon" style="background:var(--brand-tint);color:var(--brand)">🍳</div>
          <div class="chip-body">
            <div class="chip-title">${escapeHtml(r.title)}</div>
            <div class="chip-sub">${r.ingredients.length} ingredient${r.ingredients.length === 1 ? "" : "s"} · serves ${r.servings}</div>
          </div>
        </div>`).join("")}
  `;
  container.querySelectorAll(".list-chip").forEach((el) => {
    el.addEventListener("click", () => openRecipeDetail(st.recipes.find((r) => r.id === el.dataset.recipeId), nav, container));
  });
}

function ingredientRowEl(ing = { name: "", amount: "", unit: "" }) {
  const row = document.createElement("div");
  row.className = "row-2";
  row.style.marginBottom = "8px";
  row.innerHTML = `
    <input placeholder="Ingredient" class="ing-name" value="${escapeHtml(ing.name)}" style="flex:2;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)" />
    <input placeholder="Amt" type="number" step="any" class="ing-amt" value="${ing.amount ?? ""}" style="flex:1;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)" />
    <input placeholder="Unit" class="ing-unit" value="${escapeHtml(ing.unit || "")}" style="flex:1;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)" />
    <button type="button" class="ing-remove" style="border:none;background:none;color:var(--now);font-size:18px;padding:0 4px">✕</button>
  `;
  row.querySelector(".ing-remove").addEventListener("click", () => row.remove());
  return row;
}

export function openNewRecipeSheet(nav, refreshContainer) {
  openRecipeSheetInternal(null, nav, refreshContainer);
}

function openRecipeDetail(recipe, nav, refreshContainer) {
  openSheet(`
    <h2>${escapeHtml(recipe.title)}</h2>
    <div style="color:var(--text-dim);font-size:13px;margin-bottom:10px">Serves ${recipe.servings}</div>
    <div class="section-label">Ingredients</div>
    <div style="margin-bottom:12px">
      ${recipe.ingredients.map((i) => `<div class="item-row"><span style="flex:1">${escapeHtml(i.name)}</span><span class="tabular">${i.amount} ${escapeHtml(i.unit || "")}</span></div>`).join("")}
    </div>
    ${recipe.instructions ? `<div class="section-label">Instructions</div><div style="font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(recipe.instructions)}</div>` : ""}
    <div class="field" style="margin-top:16px"><label>Add to list (scaled to)</label>
      <div class="row-2">
        <select id="targetList"></select>
        <input id="scaleServings" type="number" min="1" value="${recipe.servings}" style="max-width:90px" />
      </div>
    </div>
    <button class="btn btn-primary btn-block" id="addToListBtn">Add ingredients to list</button>
    <button class="btn btn-ghost btn-block" id="editRecipeBtn" style="margin-top:8px">Edit recipe</button>
    <button class="btn btn-danger btn-block" id="delRecipeBtn" style="margin-top:8px">Delete recipe</button>
  `, {
    onMount: (root) => {
      const st = S.getState();
      const sel = root.querySelector("#targetList");
      sel.innerHTML = st.lists.map((l) => `<option value="${l.id}">${iconPlainText(l.icon)} ${escapeHtml(l.name)}</option>`).join("");
      root.querySelector("#addToListBtn").addEventListener("click", async () => {
        const listId = sel.value;
        const scale = parseFloat(root.querySelector("#scaleServings").value) || recipe.servings;
        await S.addRecipeToList(recipe.id, listId, scale);
        closeSheet();
        showToast(`Added ${recipe.ingredients.length} ingredients to your list`);
      });
      root.querySelector("#editRecipeBtn").addEventListener("click", () => openRecipeSheetInternal(recipe, nav, refreshContainer));
      root.querySelector("#delRecipeBtn").addEventListener("click", async () => {
        if (!confirm(`Delete "${recipe.title}"?`)) return;
        await S.deleteRecipe(recipe.id);
        closeSheet();
        refreshContainer && renderRecipes(refreshContainer, nav);
      });
    },
  });
}

function openRecipeSheetInternal(existingRecipe, nav, refreshContainer) {
  const isEdit = !!existingRecipe;
  openSheet(`
    <h2>${isEdit ? "Edit recipe" : "New recipe"}</h2>
    <div class="field"><label>Title</label><input id="rtitle" value="${isEdit ? escapeHtml(existingRecipe.title) : ""}" placeholder="e.g. Chicken Curry" /></div>
    <div class="field"><label>Servings</label><input id="rservings" type="number" min="1" value="${isEdit ? existingRecipe.servings : 4}" /></div>
    <div class="section-label">Ingredients</div>
    <div id="ingList"></div>
    <button type="button" class="btn btn-ghost" id="addIngRow" style="margin-bottom:14px">+ Add ingredient</button>
    <div class="field"><label>Instructions (optional)</label><textarea id="rinstr" rows="4">${isEdit ? escapeHtml(existingRecipe.instructions || "") : ""}</textarea></div>
    <button class="btn btn-primary btn-block" id="saveRecipe">${isEdit ? "Save changes" : "Create recipe"}</button>
  `, {
    onMount: (root) => {
      const ingList = root.querySelector("#ingList");
      const initial = isEdit && existingRecipe.ingredients.length ? existingRecipe.ingredients : [{ name: "", amount: "", unit: "" }];
      initial.forEach((ing) => ingList.appendChild(ingredientRowEl(ing)));
      root.querySelector("#addIngRow").addEventListener("click", () => ingList.appendChild(ingredientRowEl()));
      root.querySelector("#rtitle").focus();

      root.querySelector("#saveRecipe").addEventListener("click", async () => {
        const title = root.querySelector("#rtitle").value.trim();
        if (!title) { showToast("Recipe needs a title"); return; }
        const servings = parseFloat(root.querySelector("#rservings").value) || 4;
        const ingredients = Array.from(ingList.children).map((row) => ({
          name: row.querySelector(".ing-name").value.trim(),
          amount: parseFloat(row.querySelector(".ing-amt").value) || 0,
          unit: row.querySelector(".ing-unit").value.trim(),
        })).filter((i) => i.name);
        const instructions = root.querySelector("#rinstr").value.trim();

        if (isEdit) await S.updateRecipe(existingRecipe.id, { title, servings, ingredients, instructions });
        else await S.createRecipe({ title, servings, ingredients, instructions });
        closeSheet();
        refreshContainer && renderRecipes(refreshContainer, nav);
      });
    },
  });
}
