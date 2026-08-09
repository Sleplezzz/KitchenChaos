import { MENU } from "../constants/kitchen.js";

let idCounter = 1;

export function getNextSerial() {
  return idCounter++;
}

export function uid() {
  return `${Date.now()}-${idCounter++}`;
}

export function randomOrderItems() {
  const n = 1 + Math.floor(Math.random() * 2);
  const shuffled = [...MENU].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map((m) => m.id);
}

export function itemNames(ids) {
  return ids
    .map((id) => MENU.find((m) => m.id === id)?.name)
    .filter(Boolean)
    .join(" + ");
}

export function itemsTotal(ids, qty = 1) {
  return ids.reduce((sum, id) => sum + (MENU.find((m) => m.id === id)?.price || 0), 0) * qty;
}

export function formatClock(ts) {
  return new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
