// ui.js — shared UI primitives: bottom sheet, toast, icon/color pickers, priority picker.

import { ICON_CATEGORIES, PRIORITY, PRIORITY_ORDER, COLORS, escapeHtml, renderIconHtml } from "./constants.js";

/* ======== Bottom sheet ======== */

export function openSheet(contentHtml, { title = "", onClose = null, onMount = null } = {}) {
  closeSheet();
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.id = "activeSheetOverlay";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.id = "activeSheet";
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    ${title ? `<div class="sheet-title">${escapeHtml(title)}</div>` : ""}
    <div class="sheet-body">${contentHtml}</div>
  `;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.classList.add("open");
    sheet.classList.add("open");
  });

  if (onMount) onMount(sheet.querySelector(".sheet-body"));

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { closeSheet(); onClose?.(); }
  });

  // Swipe down to dismiss
  let startY = 0, dragging = false;
  sheet.querySelector(".sheet-handle").addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY; dragging = true;
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!dragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!dragging) return;
    const dy = e.changedTouches[0].clientY - startY;
    sheet.style.transform = "";
    if (dy > 80) { closeSheet(); onClose?.(); }
    dragging = false;
  }, { passive: true });

  return overlay;
}

export function closeSheet() {
  const overlay = document.getElementById("activeSheetOverlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  const sheet = document.getElementById("activeSheet");
  if (sheet) sheet.classList.remove("open");
  setTimeout(() => overlay.remove(), 260);
}

/* ======== Toast ======== */

let toastTimer = null;
export function showToast(msg, duration = 2800) {
  let t = document.getElementById("globalToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "globalToast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), duration);
}

/* ======== Full color picker ======== */

// Organized color grid + hex input
const COLOR_SWATCHES = [
  // Reds
  "#FF0000","#CC0000","#990000","#FF4444","#FF8888","#FFCCCC",
  // Oranges
  "#FF6600","#CC5200","#FF8833","#FFAA66","#FFD4AA","#FFF0E0",
  // Yellows
  "#FFCC00","#CC9900","#FFE033","#FFE999","#FFF6CC","#FFFFF0",
  // Greens
  "#00AA44","#008833","#006622","#44CC77","#88DDBB","#CCFFDD",
  // Teals
  "#009999","#007777","#004444","#33BBBB","#88DDDD","#CCFFFF",
  // Blues
  "#0055EE","#0033BB","#001188","#4488FF","#88AAFF","#BBCCFF",
  // Purples
  "#6600CC","#440099","#220066","#8833DD","#AA66EE","#CCAAFF",
  // Pinks
  "#FF0088","#CC0066","#FF44AA","#FF88CC","#FFCCEE","#FFF0F8",
  // Browns
  "#8B5E3C","#6B4423","#4A2B12","#C48A5B","#DEB992","#F5DEC8",
  // Grays/Blacks
  "#222222","#444444","#666666","#888888","#AAAAAA","#CCCCCC",
  // Forest & Earth
  "#2F6B4F","#3F8C8C","#A6763D","#5C6BC0","#C4708E","#6B6259",
  "#5B7FA6","#8E5BAE","#D9A227","#D14B3D","#4CAF50","#795548",
];

export function colorPickerHtml(currentColor = "#2F6B4F", id = "cp") {
  return `
    <div class="color-picker-wrap" id="${id}Wrap">
      <div class="color-swatch-preview-row">
        <div class="color-preview-swatch" id="${id}Preview" style="background:${currentColor}"></div>
        <input class="color-hex-input" id="${id}HexInput" type="text" maxlength="7" value="${currentColor}" placeholder="#2F6B4F" spellcheck="false" />
        <input type="color" id="${id}NativeInput" value="${currentColor}" style="opacity:0;width:0;height:0;position:absolute;" />
        <button class="btn-icon" id="${id}NativeBtn" title="Open color wheel">🎨</button>
      </div>
      <div class="color-swatch-grid" id="${id}Grid">
        ${COLOR_SWATCHES.map((c) => `<button class="color-swatch${c === currentColor ? " selected" : ""}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
      </div>
    </div>
  `;
}

export function wireColorPicker(id, onChange) {
  const wrap = document.getElementById(`${id}Wrap`);
  if (!wrap) return;
  const preview   = wrap.querySelector(`#${id}Preview`);
  const hexInput  = wrap.querySelector(`#${id}HexInput`);
  const nativeInp = wrap.querySelector(`#${id}NativeInput`);
  const nativeBtn = wrap.querySelector(`#${id}NativeBtn`);
  const grid      = wrap.querySelector(`#${id}Grid`);

  function setColor(color) {
    preview.style.background = color;
    hexInput.value = color;
    nativeInp.value = color;
    grid.querySelectorAll(".color-swatch").forEach((b) => b.classList.toggle("selected", b.dataset.color === color));
    onChange?.(color);
  }

  hexInput.addEventListener("input", () => {
    const v = hexInput.value.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setColor(v);
  });
  hexInput.addEventListener("blur", () => {
    let v = hexInput.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setColor(v);
    else { hexInput.value = preview.style.background; }
  });
  nativeBtn.addEventListener("click", () => nativeInp.click());
  nativeInp.addEventListener("input", () => setColor(nativeInp.value));
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".color-swatch");
    if (btn) setColor(btn.dataset.color);
  });
}

/* ======== Icon picker ======== */

export function iconPickerHtml(currentIcon = "🧺", id = "ip") {
  const isCustom = currentIcon.startsWith("__custom:");
  const [, custText = "", custBg = "#2F6B4F", custFg = "%23FFFFFF"] = isCustom ? currentIcon.split(":") : [];

  const categorySections = ICON_CATEGORIES.map((cat) => `
    <div class="icon-cat-label">${escapeHtml(cat.label)}</div>
    <div class="icon-grid-section">
      ${cat.icons.map((ic) => `<button class="icon-btn${ic === currentIcon ? " selected" : ""}" data-icon="${ic}">${ic}</button>`).join("")}
    </div>
  `).join("");

  return `
    <div class="icon-picker-wrap" id="${id}Wrap">
      <div class="icon-search-row">
        <input class="icon-search-input" id="${id}Search" type="search" placeholder="Search icons…" />
      </div>
      <div class="icon-grid-scroll" id="${id}Grid">
        ${categorySections}
      </div>
      <div class="custom-icon-section">
        <div class="custom-icon-header">✏️ Custom icon (type text/letter)</div>
        <div class="custom-icon-controls">
          <input class="custom-icon-text-input" id="${id}CustText" type="text" maxlength="3"
            placeholder="AB" value="${decodeURIComponent(custText)}" />
          <div class="custom-icon-color-wrap">
            <label class="mini-label">BG</label>
            <input type="color" id="${id}CustBg" value="${decodeURIComponent(custBg)}" class="mini-color-input" />
          </div>
          <div class="custom-icon-color-wrap">
            <label class="mini-label">Text</label>
            <input type="color" id="${id}CustFg" value="${decodeURIComponent(custFg || "#FFFFFF")}" class="mini-color-input" />
          </div>
          <div class="custom-icon-preview" id="${id}CustPreview"
            style="background:${decodeURIComponent(custBg)};color:${decodeURIComponent(custFg || '#FFFFFF')}">
            ${escapeHtml(decodeURIComponent(custText) || "AB")}
          </div>
          <button class="btn-sm btn-brand" id="${id}CustApply">Use</button>
        </div>
      </div>
    </div>
  `;
}

export function wireIconPicker(id, onChange) {
  const wrap = document.getElementById(`${id}Wrap`);
  if (!wrap) return;
  const grid       = wrap.querySelector(`#${id}Grid`);
  const search     = wrap.querySelector(`#${id}Search`);
  const custText   = wrap.querySelector(`#${id}CustText`);
  const custBg     = wrap.querySelector(`#${id}CustBg`);
  const custFg     = wrap.querySelector(`#${id}CustFg`);
  const custPreview= wrap.querySelector(`#${id}CustPreview`);
  const custApply  = wrap.querySelector(`#${id}CustApply`);

  function updateCustomPreview() {
    custPreview.style.background = custBg.value;
    custPreview.style.color      = custFg.value;
    custPreview.textContent      = custText.value.trim() || "AB";
  }
  custText.addEventListener("input",  updateCustomPreview);
  custBg.addEventListener("input",    updateCustomPreview);
  custFg.addEventListener("input",    updateCustomPreview);

  custApply.addEventListener("click", () => {
    const txt = custText.value.trim();
    if (!txt) return;
    const icon = `__custom:${encodeURIComponent(txt)}:${encodeURIComponent(custBg.value)}:${encodeURIComponent(custFg.value)}`;
    grid.querySelectorAll(".icon-btn").forEach((b) => b.classList.remove("selected"));
    onChange?.(icon);
  });

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".icon-btn");
    if (!btn) return;
    grid.querySelectorAll(".icon-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    onChange?.(btn.dataset.icon);
  });

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    grid.querySelectorAll(".icon-btn").forEach((b) => {
      b.style.display = (!q || b.dataset.icon.toLowerCase().includes(q)) ? "" : "none";
    });
    grid.querySelectorAll(".icon-cat-label").forEach((lbl) => {
      const section = lbl.nextElementSibling;
      const anyVisible = section && Array.from(section.querySelectorAll(".icon-btn")).some((b) => b.style.display !== "none");
      lbl.style.display = anyVisible ? "" : "none";
      if (section) section.style.display = anyVisible ? "" : "none";
    });
  });
}

/* ======== Legacy single wireIconColorPickers (for backward compat) ======== */
export function wireIconColorPickers(containerId, { onIcon, onColor } = {}) {
  // No-op — replaced by separate wireIconPicker / wireColorPicker calls
}

/* ======== Priority picker ======== */

export function priorityPickerHtml(current = "soon", id = "pp") {
  return `
    <div class="priority-picker" id="${id}">
      ${PRIORITY_ORDER.map((key) => {
        const p = PRIORITY[key];
        return `<button class="pri-btn${current === key ? " active" : ""}" data-pri="${key}"
          style="--pri-c:${p.color};--pri-t:${p.tint}">${p.label}</button>`;
      }).join("")}
    </div>
  `;
}

export function wirePriorityPicker(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", (e) => {
    const btn = e.target.closest(".pri-btn");
    if (!btn) return;
    el.querySelectorAll(".pri-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    onChange?.(btn.dataset.pri);
  });
}

export function priorityTagHtml(priority) {
  const p = PRIORITY[priority];
  if (!p) return "";
  return `<span class="pri-tag" style="background:${p.tint};color:${p.color}">${p.label}</span>`;
}

/* ======== Info tooltip ======== */

export function infoBtn(text) {
  return `<button class="info-btn" data-info="${escapeHtml(text)}" aria-label="Info">ℹ</button>`;
}

export function wireInfoBtns(container) {
  container.querySelectorAll(".info-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const existing = document.getElementById("infoTooltip");
      if (existing) existing.remove();
      const tip = document.createElement("div");
      tip.id = "infoTooltip";
      tip.className = "info-tooltip";
      tip.textContent = btn.dataset.info;
      document.body.appendChild(tip);
      const r = btn.getBoundingClientRect();
      const tipW = 240, tipH = 60;
      let left = r.left + r.width / 2 - tipW / 2;
      let top  = r.top - tipH - 8 + window.scrollY;
      if (left < 8) left = 8;
      if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
      if (top < 8) top = r.bottom + 8 + window.scrollY;
      tip.style.cssText = `left:${left}px;top:${top}px;width:${tipW}px`;
      const dismiss = (ev) => { if (!tip.contains(ev.target)) { tip.remove(); document.removeEventListener("click", dismiss); } };
      setTimeout(() => document.addEventListener("click", dismiss), 10);
    });
  });
}
