// notify.js — push notifications, today badge, escalation alerts, ICS export.

import * as S from "./state.js";
import { PRIORITY } from "./constants.js";

export async function requestPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

function fireNotification(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, { body, tag, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png" });
    }).catch(() => new Notification(title, { body, tag }));
  } else {
    new Notification(title, { body, tag });
  }
}

export async function notifyEscalations(escalated) {
  if (!escalated || escalated.length === 0) return;
  const ok = await requestPermission();
  if (!ok) return;
  for (const { item, from, to } of escalated) {
    const fromLabel = PRIORITY[from]?.label || from;
    const toLabel   = PRIORITY[to]?.label   || to;
    fireNotification(
      `🔼 Priority update: ${item.name}`,
      `Moved from "${fromLabel}" → "${toLabel}"`,
      `escalation-${item.id}`
    );
  }
}

export function updateTodayBadge() {
  const items = S.getTodayItems();
  const badge = document.getElementById("todayBadge");
  if (badge) {
    badge.textContent = items.length;
    badge.style.display = items.length > 0 ? "" : "none";
  }
}

export function notifyTodayItems() {
  const items = S.getTodayItems();
  if (!items.length) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const titles = items.slice(0, 3).map((i) => i.name).join(", ");
  const extra  = items.length > 3 ? ` +${items.length - 3} more` : "";
  fireNotification(
    `📋 ${items.length} item${items.length > 1 ? "s" : ""} due today`,
    titles + extra,
    "today-summary"
  );
}

/* ---- ICS export ---- */

function pad(n) { return String(n).padStart(2, "0"); }

function toICSDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsEscape(str) { return String(str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }

export function exportICS() {
  const items = S.getUpcomingItems(60).filter((i) => i.priority !== "wishlist");
  if (!items.length) return alert("No upcoming items with due dates to export.");
  const st = S.getState();
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Mylist//EN","CALSCALE:GREGORIAN"];
  for (const item of items) {
    const list = st.lists.find((l) => l.id === item.listId);
    const ds = toICSDate(item.dueDate);
    const tomorrow = new Date(item.dueDate + "T00:00:00");
    tomorrow.setDate(tomorrow.getDate() + 1);
    const de = `${tomorrow.getFullYear()}${pad(tomorrow.getMonth() + 1)}${pad(tomorrow.getDate())}`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:mylist-${item.id}@larder`);
    lines.push(`DTSTART;VALUE=DATE:${ds}`);
    lines.push(`DTEND;VALUE=DATE:${de}`);
    lines.push(`SUMMARY:${icsEscape(item.name)}${list ? ` (${icsEscape(list.name)})` : ""}`);
    if (item.note) lines.push(`DESCRIPTION:${icsEscape(item.note)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "mylist-upcoming.ics";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
