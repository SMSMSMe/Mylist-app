// state.js — single in-memory store backed by IndexedDB.

import { Store, uid } from "./db.js";
import { DEFAULT_CATEGORIES, PRIORITY_ORDER, ESCALATION_CHAIN, calcItemPrice, todayISO } from "./constants.js";

const state = {
  ready: false,
  folders: [], lists: [], categories: [], stores: [],
  items: [], recipes: [], mealPlan: [], history: [],
  settings: {
    theme: "dark",
    chartCalcMode: "midpoint",    // "high" | "low" | "midpoint"
    customUnits: [],              // array of strings
    recipesEnabled: true,
    pinLock: null,
    defaultListId: null,
  },
};

const subscribers = new Set();
function notify() { for (const fn of subscribers) fn(state); }
export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
export function getState() { return state; }

async function persistSettings() {
  await Store.put("meta", { id: "settings", value: state.settings });
}

export async function init() {
  const [folders, lists, categories, stores, items, recipes, mealPlan, history, settingsRow] = await Promise.all([
    Store.getAll("folders"), Store.getAll("lists"), Store.getAll("categories"),
    Store.getAll("stores"), Store.getAll("items"), Store.getAll("recipes"),
    Store.getAll("mealPlan"), Store.getAll("history"), Store.get("meta", "settings"),
  ]);

  state.folders = folders;
  state.lists = lists.map((l) => ({ wishlistHidden: true, ...l }));
  state.categories = categories;
  state.stores = stores;
  // Migrate old price field to priceMin/priceMax
  state.items = items.map((it) => {
    const out = { escalationDate: null, ...it };
    if (out.price !== undefined && out.priceMin === undefined) {
      out.priceMin = out.price || 0; out.priceMax = 0;
    }
    if (out.priceMin === undefined) out.priceMin = 0;
    if (out.priceMax === undefined) out.priceMax = 0;
    delete out.price;
    if (!out.priority || !PRIORITY_ORDER.includes(out.priority)) out.priority = "soon";
    return out;
  });
  state.recipes = recipes;
  state.mealPlan = mealPlan;
  state.history = history;
  if (settingsRow && settingsRow.value) {
    state.settings = { ...state.settings, ...settingsRow.value };
    if (!Array.isArray(state.settings.customUnits)) state.settings.customUnits = [];
  }

  // First-run seed
  if (state.categories.length === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      const cat = { id: uid(), ...c, order: state.categories.length };
      state.categories.push(cat);
      await Store.put("categories", cat);
    }
  }
  if (state.lists.length === 0) {
    const list = { id: uid(), name: "Groceries", icon: "🧺", color: "#2F6B4F", folderId: null, order: 0, wishlistHidden: true };
    state.lists.push(list);
    await Store.put("lists", list);
    state.settings.defaultListId = list.id;
    await persistSettings();
  }

  state.ready = true;
  notify();
}

/* ---------------- Lists ---------------- */

export async function createList({ name, icon = "🧺", color = "#2F6B4F", folderId = null }) {
  const list = { id: uid(), name, icon, color, folderId, order: state.lists.length, wishlistHidden: true };
  state.lists.push(list);
  await Store.put("lists", list);
  notify(); return list;
}

export async function updateList(id, patch) {
  const list = state.lists.find((l) => l.id === id);
  if (!list) return;
  Object.assign(list, patch);
  await Store.put("lists", list);
  notify();
}

export async function deleteList(id) {
  state.lists = state.lists.filter((l) => l.id !== id);
  state.items = state.items.filter((it) => it.listId !== id);
  await Store.delete("lists", id);
  const remaining = await Store.getAll("items");
  for (const it of remaining) if (it.listId === id) await Store.delete("items", it.id);
  notify();
}

/* ---------------- Folders ---------------- */

export async function createFolder({ name, icon = "📁", color = "#6B8CAE" }) {
  const folder = { id: uid(), name, icon, color, order: state.folders.length };
  state.folders.push(folder);
  await Store.put("folders", folder);
  notify(); return folder;
}

export async function deleteFolder(id) {
  state.folders = state.folders.filter((f) => f.id !== id);
  for (const l of state.lists) if (l.folderId === id) l.folderId = null;
  await Store.delete("folders", id);
  for (const l of state.lists.filter((l) => l.folderId === null)) await Store.put("lists", l);
  notify();
}

/* ---------------- Categories ---------------- */

export async function createCategory({ name, icon = "🏷️", color = "#2F6B4F" }) {
  const cat = { id: uid(), name, icon, color, order: state.categories.length };
  state.categories.push(cat);
  await Store.put("categories", cat);
  notify(); return cat;
}

export async function updateCategory(id, patch) {
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return;
  Object.assign(cat, patch);
  await Store.put("categories", cat);
  notify();
}

export async function deleteCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  await Store.delete("categories", id);
  notify();
}

/* ---------------- Items ---------------- */

export async function createItem({
  listId, name, qty = 1, unit = "", priceMin = 0, priceMax = 0,
  category = "", store = "", priority = "soon", dueDate = null,
  escalationDate = null, note = "", favorite = false, photo = null,
}) {
  const item = {
    id: uid(), listId, name, qty, unit, priceMin, priceMax, category, store,
    priority, dueDate, escalationDate, note, favorite, photo,
    checked: false, checkedAt: null, order: state.items.length, createdAt: new Date().toISOString(),
  };
  state.items.push(item);
  await Store.put("items", item);
  notify(); return item;
}

export async function updateItem(id, patch) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  Object.assign(item, patch);
  await Store.put("items", item);
  notify();
}

export async function deleteItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  await Store.delete("items", id);
  notify();
}

export async function toggleChecked(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  item.checkedAt = item.checked ? new Date().toISOString() : null;
  await Store.put("items", item);
  notify();
}

export async function toggleFavorite(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  await Store.put("items", item);
  notify();
}

/* ---------------- Escalation ---------------- */

export async function runEscalation() {
  const today = todayISO();
  const escalated = [];
  for (const item of state.items) {
    if (!item.escalationDate || item.checked) continue;
    if (item.escalationDate > today) continue;
    const next = ESCALATION_CHAIN[item.priority];
    if (!next) continue; // already at "now"
    const from = item.priority;
    item.priority = next;
    item.escalationDate = null;
    await Store.put("items", item);
    escalated.push({ item, from, to: next });
  }
  if (escalated.length) notify();
  return escalated;
}

/* ---------------- Recipes ---------------- */

export async function createRecipe({ title, servings = 4, ingredients = [], instructions = "", photo = null }) {
  const recipe = { id: uid(), title, servings, ingredients, instructions, photo, createdAt: new Date().toISOString() };
  state.recipes.push(recipe);
  await Store.put("recipes", recipe);
  notify(); return recipe;
}

export async function updateRecipe(id, patch) {
  const r = state.recipes.find((r) => r.id === id);
  if (!r) return;
  Object.assign(r, patch);
  await Store.put("recipes", r);
  notify();
}

export async function deleteRecipe(id) {
  state.recipes = state.recipes.filter((r) => r.id !== id);
  await Store.delete("recipes", id);
  state.mealPlan = state.mealPlan.filter((m) => m.recipeId !== id);
  notify();
}

export async function addRecipeToList(recipeId, listId, scaleServings = null) {
  const recipe = state.recipes.find((r) => r.id === recipeId);
  if (!recipe) return;
  const factor = scaleServings ? scaleServings / recipe.servings : 1;
  for (const ing of recipe.ingredients) {
    await createItem({
      listId, name: ing.name,
      qty: Math.round((ing.amount || 0) * factor * 100) / 100,
      unit: ing.unit || "", category: ing.category || "", priority: "soon",
    });
  }
}

/* ---------------- Meal plan ---------------- */

export async function setMealPlan(dateISO, recipeId) {
  let entry = state.mealPlan.find((m) => m.dateISO === dateISO);
  if (!entry) { entry = { id: uid(), dateISO, recipeId }; state.mealPlan.push(entry); }
  else entry.recipeId = recipeId;
  await Store.put("mealPlan", entry);
  notify();
}

export async function clearMealPlan(dateISO) {
  const entry = state.mealPlan.find((m) => m.dateISO === dateISO);
  if (!entry) return;
  state.mealPlan = state.mealPlan.filter((m) => m.id !== entry.id);
  await Store.delete("mealPlan", entry.id);
  notify();
}

/* ---------------- Settings ---------------- */

export async function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await persistSettings();
  notify();
}

/* ---------------- Computed helpers ---------------- */

const PRI = { now: 0, soon: 1, norush: 2, wishlist: 3 };

function byPriorityThenName(a, b) {
  const pa = PRI[a.priority] ?? 99, pb = PRI[b.priority] ?? 99;
  return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
}

export function getItemsForList(listId, { sortBy = "category", search = "", storeFilter = "all" } = {}) {
  const list = state.lists.find((l) => l.id === listId);
  const hideWishlist = list ? list.wishlistHidden !== false : true;

  let items = state.items.filter((i) => i.listId === listId);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((i) => i.name.toLowerCase().includes(q));
  }
  if (storeFilter !== "all") items = items.filter((i) => i.store === storeFilter);
  if (hideWishlist) items = items.filter((i) => i.priority !== "wishlist");

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  const byDate = (a, b) => {
    if (!a.dueDate && !b.dueDate) return byPriorityThenName(a, b);
    if (!a.dueDate) return 1; if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate) || byPriorityThenName(a, b);
  };
  const byCategory = (a, b) => (a.category || "").localeCompare(b.category || "") || byPriorityThenName(a, b);

  const sorter = sortBy === "date" ? byDate : sortBy === "priority" ? byPriorityThenName : byCategory;
  unchecked.sort(sorter);
  checked.sort((a, b) => (b.checkedAt || "").localeCompare(a.checkedAt || ""));
  return { unchecked, checked };
}

export function getListProgress(listId) {
  const items = state.items.filter((i) => i.listId === listId && i.priority !== "wishlist");
  const total = items.length;
  const completed = items.filter((i) => i.checked).length;
  return { completed, total };
}

export function getListTotals(listId) {
  const items = state.items.filter((i) => i.listId === listId && i.priority !== "wishlist");
  const mode = state.settings.chartCalcMode || "midpoint";
  let spent = 0, planned = 0;
  for (const i of items) {
    const lineTotal = calcItemPrice(i.priceMin, i.priceMax, i.qty, mode);
    if (i.checked) spent += lineTotal; else planned += lineTotal;
  }
  return { spent, planned, total: spent + planned, count: items.length };
}

export function getCategoryBreakdown(listId, scope = "planned") {
  const mode = state.settings.chartCalcMode || "midpoint";
  const items = state.items.filter(
    (i) => i.listId === listId && i.priority !== "wishlist" &&
    (scope === "all" || (scope === "planned" ? !i.checked : i.checked))
  );
  const map = new Map();
  for (const i of items) {
    const key = i.category || "Uncategorized";
    const lineTotal = calcItemPrice(i.priceMin, i.priceMax, i.qty, mode);
    map.set(key, (map.get(key) || 0) + lineTotal);
  }
  return Array.from(map.entries()).map(([category, value]) => ({ category, value }));
}

export function getAllItemsSorted() {
  return state.items
    .filter((i) => !i.checked)
    .sort((a, b) => byPriorityThenName(a, b) || (a.dueDate || "z").localeCompare(b.dueDate || "z"));
}

export function getWishlistItems() {
  return state.items.filter((i) => i.priority === "wishlist" && !i.checked);
}

export function getTodayItems() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return state.items
    .filter((i) => !i.checked && i.dueDate && new Date(i.dueDate + "T00:00:00") <= today)
    .sort((a, b) => {
      const pa = PRI[a.priority] ?? 99, pb = PRI[b.priority] ?? 99;
      return pa - pb || a.dueDate.localeCompare(b.dueDate);
    });
}

export function getUpcomingItems(daysAhead = 14) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + daysAhead);
  return state.items
    .filter((i) => !i.checked && i.dueDate)
    .filter((i) => { const d = new Date(i.dueDate + "T00:00:00"); return d <= horizon; })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function searchItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return state.items.filter((i) => i.name.toLowerCase().includes(q));
}

export function suggestForName(name) {
  const match = state.items
    .filter((i) => i.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
  return match ? { category: match.category, unit: match.unit, store: match.store, priceMin: match.priceMin, priceMax: match.priceMax } : null;
}
