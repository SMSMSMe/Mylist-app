// db.js — local storage layer (IndexedDB) + versioned backup export/import.

const DB_NAME = "larder-db";
const DB_VERSION = 1;
const BACKUP_SCHEMA_VERSION = 2;

const STORE_NAMES = ["meta","folders","lists","categories","stores","items","recipes","mealPlan","history"];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const name of STORE_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode = "readonly") {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

export const Store = {
  async getAll(storeName) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  async get(storeName, id) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },
  async put(storeName, value) {
    const store = await tx(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  },
  async delete(storeName, id) {
    const store = await tx(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },
  async clear(storeName) {
    const store = await tx(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ---------- Backup: export ----------

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function serializePhotos(items) {
  const out = [];
  for (const item of items) {
    const copy = { ...item };
    if (copy.photo instanceof Blob) {
      copy.photo = await blobToBase64(copy.photo);
      copy.photoIsDataUrl = true;
    }
    out.push(copy);
  }
  return out;
}

export async function exportBackup() {
  const [folders, lists, categories, stores, items, recipes, mealPlan, history, metaRows] = await Promise.all([
    Store.getAll("folders"), Store.getAll("lists"), Store.getAll("categories"),
    Store.getAll("stores"), Store.getAll("items"), Store.getAll("recipes"),
    Store.getAll("mealPlan"), Store.getAll("history"), Store.getAll("meta"),
  ]);
  const meta = {};
  for (const row of metaRows) meta[row.id] = row.value;
  return {
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    appName: "Mylist",
    exportedAt: new Date().toISOString(),
    data: {
      folders, lists, categories, stores,
      items: await serializePhotos(items),
      recipes: await serializePhotos(recipes),
      mealPlan, history,
      settings: meta.settings || {},
    },
  };
}

export async function downloadBackup() {
  const payload = await exportBackup();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `mylist-backup-${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Backup: import ----------

const migrations = {
  // v1 → v2: convert price to priceMin/priceMax, add escalationDate & wishlistHidden
  1: (data) => {
    data.items = (data.items || []).map((it) => ({
      priceMin: it.price || 0,
      priceMax: 0,
      escalationDate: null,
      ...it,
    }));
    data.lists = (data.lists || []).map((l) => ({
      wishlistHidden: true,
      ...l,
    }));
    return data;
  },
};

function migrateData(payload) {
  let { backupSchemaVersion, data } = payload;
  backupSchemaVersion = backupSchemaVersion || 1;
  while (backupSchemaVersion < BACKUP_SCHEMA_VERSION) {
    const step = migrations[backupSchemaVersion];
    if (!step) break;
    data = step(data);
    backupSchemaVersion += 1;
  }
  return data;
}

function withDefaults(record, defaults) {
  return { ...defaults, ...record };
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function importBackup(payload, { replaceExisting = true } = {}) {
  if (!payload || !payload.data) throw new Error("This file doesn't look like a Mylist backup.");
  const data = migrateData(payload);
  if (replaceExisting) {
    for (const name of ["folders","lists","categories","stores","items","recipes","mealPlan","history"]) {
      await Store.clear(name);
    }
  }
  const itemDefaults = {
    qty: 1, unit: "", priceMin: 0, priceMax: 0, priority: "soon",
    checked: false, favorite: false, note: "", store: "", category: "",
    dueDate: null, escalationDate: null,
  };
  const listDefaults = { icon: "🧺", color: "#2F6B4F", folderId: null, wishlistHidden: true };
  const folderDefaults = { icon: "📁", color: "#6B8CAE" };
  const categoryDefaults = { icon: "🏷️", color: "#2F6B4F" };
  const recipeDefaults = { servings: 4, ingredients: [], instructions: "" };

  for (const f of data.folders || []) await Store.put("folders", withDefaults(f, folderDefaults));
  for (const l of data.lists || []) await Store.put("lists", withDefaults(l, listDefaults));
  for (const c of data.categories || []) await Store.put("categories", withDefaults(c, categoryDefaults));
  for (const s of data.stores || []) await Store.put("stores", s);
  for (const r of data.recipes || []) {
    const copy = { ...r };
    if (copy.photoIsDataUrl && typeof copy.photo === "string") {
      copy.photo = await dataUrlToBlob(copy.photo); delete copy.photoIsDataUrl;
    }
    await Store.put("recipes", withDefaults(copy, recipeDefaults));
  }
  for (const m of data.mealPlan || []) await Store.put("mealPlan", m);
  for (const h of data.history || []) await Store.put("history", h);
  for (const it of data.items || []) {
    const copy = { ...it };
    if (copy.photoIsDataUrl && typeof copy.photo === "string") {
      copy.photo = await dataUrlToBlob(copy.photo); delete copy.photoIsDataUrl;
    }
    // backward compat: old price field
    if (copy.price !== undefined && copy.priceMin === undefined) {
      copy.priceMin = copy.price || 0; copy.priceMax = 0;
    }
    delete copy.price;
    await Store.put("items", withDefaults(copy, itemDefaults));
  }
  if (data.settings) await Store.put("meta", { id: "settings", value: data.settings });
  return true;
}
